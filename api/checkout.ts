// POST /api/checkout  { ticketTypeId, quantity, affiliateCode?, visitorId? }
// Holds stock, then opens a Stripe Checkout page for the exact server-side price.
// Anyone signed in can buy. A valid partner link is recorded on the order for partner reporting.
import { z } from 'zod';
import { env } from '../server/env.js';
import { bodyOf, fromDbError, handler, HttpError } from '../server/http.js';
import { ensureCustomer, stripe } from '../server/stripe.js';
import { db, requireUser } from '../server/supabase.js';

const Body = z.object({
  ticketTypeId: z.string().uuid(),
  quantity: z.number().int().min(1).max(20),
  affiliateCode: z.string().trim().max(40).optional(),
  visitorId: z.string().max(64).optional(),
  marketingChannel: z.string().max(40).optional(),
});

const STRIPE_SESSION_MINUTES = 31; // Stripe's minimum is 30; the database hold lasts 35 so it always outlives the page.

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const body = bodyOf(req, Body.parse);

  const { data: order, error } = await db().rpc('create_reservation', {
    p_user: user.id,
    p_ticket_type: body.ticketTypeId,
    p_quantity: body.quantity,
    p_affiliate_code: body.affiliateCode ?? null,
  });
  if (error) throw fromDbError(error);

  if (order.route === 'affiliate' && order.affiliate_link_id) {
    await db().rpc('attribute_user_to_link', { p_user: user.id, p_link: order.affiliate_link_id, p_visitor: body.visitorId ?? null });
  }
  if (body.marketingChannel) await db().from('orders').update({ marketing_channel: body.marketingChannel }).eq('id', order.id);

  const { data: ev } = await db().from('events').select('slug, title, image_url, venue:venues(name)').eq('id', order.event_id).single();
  const site = env().SITE_URL;
  try {
    const customer = await ensureCustomer(user);
    const lines = [{
      quantity: order.quantity,
      price_data: {
        currency: 'gbp',
        unit_amount: order.unit_price_pence,
        product_data: {
          name: `${ev?.title} (${order.ticket_type_name})`,
          description: (ev?.venue as unknown as { name: string } | null)?.name ?? undefined,
          images: ev?.image_url ? [ev.image_url] : undefined,
        },
      },
    }];
    if (order.unit_fee_pence > 0) {
      lines.push({ quantity: order.quantity, price_data: { currency: 'gbp', unit_amount: order.unit_fee_pence, product_data: { name: 'Booking fee', description: undefined, images: undefined } } });
    }
    const back = order.route === 'affiliate' && body.affiliateCode ? `${site}/go/${encodeURIComponent(body.affiliateCode)}` : `${site}/events/${ev?.slug}`;
    const session = await stripe().checkout.sessions.create(
      {
        mode: 'payment',
        customer,
        client_reference_id: user.id,
        line_items: lines,
        success_url: `${site}/wallet?order=${order.ref}&paid=1`,
        cancel_url: `${back}?cancelled=1`,
        expires_at: Math.floor(Date.now() / 1000) + STRIPE_SESSION_MINUTES * 60,
        metadata: { order_id: order.id, order_ref: order.ref, kind: 'tickets' },
        payment_intent_data: { metadata: { order_id: order.id, order_ref: order.ref } },
      },
      { idempotencyKey: `checkout-${order.id}` },
    );
    await db().from('orders').update({ stripe_checkout_session_id: session.id }).eq('id', order.id);
    return { url: session.url, orderRef: order.ref, expiresAt: new Date(session.expires_at * 1000).toISOString() };
  } catch (e) {
    await db().rpc('release_reservation', { p_reservation: order.reservation_id, p_status: 'cancelled' });
    if (e instanceof HttpError) throw e;
    console.error('Stripe checkout failed', e);
    throw new HttpError(502, 'PAYMENT_UNAVAILABLE', 'Payments are not available right now. Please try again in a minute.', true);
  }
});
