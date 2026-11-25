import { env } from './env.js';
import { db } from './supabase.js';
import { enqueueEmail } from './email/outbox.js';
import { formatPence } from './stripe.js';

const REMINDER_MS = 24 * 3600_000; // reminder email goes the day before doors
const REMINDER_MIN_GAP_MS = 2 * 3600_000; // no reminder if the order email went out less than ~2 hours earlier

const fmt = (d: Date, tz: string, o: Intl.DateTimeFormatOptions) => new Intl.DateTimeFormat('en-GB', { timeZone: tz, ...o }).format(d);
export const dateLong = (d: Date, tz = 'Europe/London') => fmt(d, tz, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
export const dateShort = (d: Date, tz = 'Europe/London') => fmt(d, tz, { weekday: 'short', day: 'numeric', month: 'short' });
export const timeOf = (d: Date, tz = 'Europe/London') => fmt(d, tz, { hour: 'numeric', minute: '2-digit', hour12: true }).replace(' ', '').toLowerCase();

type OrderFull = {
  id: string; ref: string; user_id: string; quantity: number; ticket_type_name: string; unit_price_pence: number;
  unit_fee_pence: number; subtotal_pence: number; fee_total_pence: number; total_pence: number; refunded_pence: number;
  profile: { email: string; first_name: string | null };
  event: { id: string; slug: string; title: string; image_url: string | null; doors_at: string; starts_at: string;
    venue: { name: string; city: string; address_line: string | null; postcode: string | null; timezone: string } };
};

export async function loadOrder(orderId: string): Promise<OrderFull> {
  const { data, error } = await db().from('orders')
    .select('id, ref, user_id, quantity, ticket_type_name, unit_price_pence, unit_fee_pence, subtotal_pence, fee_total_pence, total_pence, refunded_pence, profile:profiles(email, first_name), event:events(id, slug, title, image_url, doors_at, starts_at, venue:venues(name, city, address_line, postcode, timezone))')
    .eq('id', orderId).single();
  if (error) throw error;
  return data as unknown as OrderFull;
}

function eventVars(o: OrderFull) {
  const site = env().SITE_URL;
  const tz = o.event.venue.timezone;
  const doors = new Date(o.event.doors_at);
  const address = [o.event.venue.address_line, o.event.venue.city, o.event.venue.postcode].filter(Boolean).join(', ');
  return {
    first_name: o.profile.first_name || 'there',
    order_ref: o.ref,
    event_name: o.event.title,
    event_date: dateLong(new Date(o.event.starts_at), tz),
    event_date_short: dateShort(new Date(o.event.starts_at), tz),
    event_day: fmt(doors, tz, { weekday: 'long' }),
    doors_time: timeOf(doors, tz),
    venue_name: o.event.venue.name,
    venue_area: o.event.venue.city,
    venue_address: address,
    maps_url: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${o.event.venue.name}, ${address}`)}`,
    event_image_url: o.event.image_url || `${site}/email-assets/event-fallback.jpg`,
    qty: String(o.quantity),
    ticket_type: o.ticket_type_name,
    order_url: `${site}/wallet?order=${o.ref}`,
    tickets_url: `${site}/wallet?order=${o.ref}`,
    wallet_url: `${site}/wallet?order=${o.ref}`,
    events_url: `${site}/`,
    refund_policy_url: `${site}/legal/refunds`,
    calendar_url: `${site}/api/calendar?event=${o.event.slug}`,
    payment_method: 'card',
  };
}

/** Queues the order emails after payment. Dedupe keys make this safe to call more than once. */
export async function queuePaidOrderEmails(orderId: string) {
  const o = await loadOrder(orderId);
  const doors = new Date(o.event.doors_at);
  const vars = {
    ...eventVars(o),
    unit_price: formatPence(o.unit_price_pence),
    line_total: formatPence(o.subtotal_pence),
    fee_total: formatPence(o.fee_total_pence),
    order_total: formatPence(o.total_pence),
  };
  await enqueueEmail({ template: 'order-confirmed', to: o.profile.email, userId: o.user_id, payload: vars, dedupeKey: `order-confirmed:${o.id}` });
  // Door passes are in the order email. A reminder follows the day before doors, unless the
  // show is so close that it would land right after the order email.
  const remindAt = new Date(doors.getTime() - REMINDER_MS);
  if (remindAt.getTime() - Date.now() >= REMINDER_MIN_GAP_MS) {
    await enqueueEmail({
      template: 'event-reminder', to: o.profile.email, userId: o.user_id, payload: vars, dedupeKey: `event-reminder:${o.id}`,
      sendAfter: remindAt,
    });
  }
}

/** Stops a scheduled reminder email for a refunded order. */
export async function cancelPendingOrderEmails(orderId: string) {
  await db().from('email_outbox').update({ status: 'cancelled' }).eq('dedupe_key', `event-reminder:${orderId}`).eq('status', 'queued');
}

export async function queueEventCancelledEmail(orderId: string, refundPence: number) {
  const o = await loadOrder(orderId);
  await enqueueEmail({
    template: 'event-cancelled', to: o.profile.email, userId: o.user_id, dedupeKey: `event-cancelled:${o.id}`,
    payload: { ...eventVars(o), refund_amount: formatPence(refundPence) },
  });
}

/** A single refund made by staff (not a whole-event cancellation, which sends event-cancelled instead). */
export async function queueRefundIssuedEmail(orderId: string, refundPence: number, refundNote: string) {
  const o = await loadOrder(orderId);
  await enqueueEmail({
    template: 'refund-issued', to: o.profile.email, userId: o.user_id, dedupeKey: `refund-issued:${o.id}:${o.refunded_pence}`,
    payload: { ...eventVars(o), refund_amount: formatPence(refundPence), refund_note: refundNote },
  });
}

export type EventChange = { change_label: string; change_reason: string; old_details: string; new_details: string; refund_deadline: string; version: string };

/** Tells a ticket holder about a new date, time or venue. Their door passes keep working; they can ask for a refund. */
export async function queueEventChangedEmail(orderId: string, c: EventChange) {
  const o = await loadOrder(orderId);
  const { version, ...vars } = c;
  await enqueueEmail({
    template: 'event-changed', to: o.profile.email, userId: o.user_id, dedupeKey: `event-changed:${o.id}:${version}`,
    payload: {
      ...eventVars(o), ...vars,
      refund_request_url: `mailto:support@doorsteptickets.com?subject=${encodeURIComponent(`Refund for order ${o.ref}`)}`,
    },
  });
}
