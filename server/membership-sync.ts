import type Stripe from 'stripe';
import { env } from './env.js';
import { db } from './supabase.js';
import { stripe, formatPence } from './stripe.js';
import { entitlementFromStripe, type EntitlementUpsert } from './membership.js';
import { enqueueEmail } from './email/outbox.js';
import { dateLong, dateShort } from './orders.js';

async function userIdForCustomer(sub: Stripe.Subscription): Promise<string | null> {
  if (sub.metadata?.user_id) return sub.metadata.user_id;
  const customerId = typeof sub.customer === 'string' ? sub.customer : sub.customer.id;
  const { data } = await db().from('profiles').select('id').eq('stripe_customer_id', customerId).maybeSingle();
  return data?.id ?? null;
}

export async function upsertEntitlement(ent: EntitlementUpsert, eventAt: Date) {
  const { data: prev } = await db().from('membership_entitlements')
    .select('status, last_provider_event_at').eq('source', ent.source).eq('provider_ref', ent.provider_ref).maybeSingle();
  // Ignore an event older than one already applied (Apple can deliver out of order; Stripe data is re-fetched anyway).
  if (prev?.last_provider_event_at && new Date(prev.last_provider_event_at) > eventAt && ent.source === 'apple') return { prev, changed: false };
  const { error } = await db().from('membership_entitlements')
    .upsert({ ...ent, last_provider_event_at: eventAt.toISOString() }, { onConflict: 'source,provider_ref' });
  if (error) throw error;
  return { prev, changed: true };
}

/** Re-reads the subscription from Stripe (so event order does not matter) and updates access. */
export async function syncStripeSubscription(subscriptionId: string, eventAt: Date) {
  const sub = await stripe().subscriptions.retrieve(subscriptionId);
  const userId = await userIdForCustomer(sub);
  if (!userId) throw new Error(`No Doorstep user for subscription ${sub.id}`);
  const ent = entitlementFromStripe(sub, userId, env().MEMBERSHIP_GRACE_DAYS);
  const { prev } = await upsertEntitlement(ent, eventAt);

  const nowActive = ent.status === 'active' || ent.status === 'trialing';
  const wasActive = prev && (prev.status === 'active' || prev.status === 'trialing');
  if (nowActive && !wasActive) {
    const { data: p } = await db().from('profiles').select('email, first_name').eq('id', userId).single();
    const price = sub.items.data[0]?.price;
    const start = new Date(sub.start_date * 1000);
    if (p) {
      await enqueueEmail({
        template: 'membership-active', to: p.email, userId, dedupeKey: `membership-active:${sub.id}`,
        payload: {
          first_name: p.first_name || 'there',
          membership_price: price?.unit_amount != null ? `${formatPence(price.unit_amount)}/month` : '',
          start_date: dateLong(start),
          renewal_date: ent.current_period_end ? dateLong(new Date(ent.current_period_end)) : '',
          events_url: `${env().SITE_URL}/`,
          payment_method: 'card',
        },
      });
    }
  }
  return ent;
}

/** Stripe sends invoice.upcoming a set number of days before renewal (set in the Stripe dashboard). */
export async function queueRenewalReminder(invoice: Stripe.Invoice) {
  const subId = typeof invoice.subscription === 'string' ? invoice.subscription : invoice.subscription?.id;
  if (!subId) return;
  const sub = await stripe().subscriptions.retrieve(subId);
  if (sub.cancel_at_period_end || sub.status === 'canceled') return;
  const userId = await userIdForCustomer(sub);
  if (!userId) return;
  const { data: p } = await db().from('profiles').select('email, first_name').eq('id', userId).single();
  if (!p) return;
  const renews = new Date((invoice.next_payment_attempt ?? sub.current_period_end) * 1000);
  await enqueueEmail({
    template: 'renewal-reminder', to: p.email, userId, dedupeKey: `renewal-reminder:${sub.id}:${sub.current_period_end}`,
    payload: {
      first_name: p.first_name || 'there',
      membership_price: `${formatPence(invoice.amount_due)}/month`,
      renewal_date: dateLong(renews),
      renewal_date_short: dateShort(renews),
      membership_url: `${env().SITE_URL}/account`,
      payment_method: 'card',
    },
  });
}
