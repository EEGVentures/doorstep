// POST /api/webhooks/stripe
// The only thing that marks an order paid. The browser's
// success redirect is never trusted. Every event is recorded once and processed idempotently.
import type Stripe from 'stripe';
import { env } from '../../server/env.js';
import { handler, HttpError, rawBody } from '../../server/http.js';
import { stripe } from '../../server/stripe.js';
import { db } from '../../server/supabase.js';
import { cancelPendingOrderEmails, queuePaidOrderEmails } from '../../server/orders.js';

export const config = { api: { bodyParser: false } };

export default handler(['POST'], async (req, res) => {
  const sig = req.headers['stripe-signature'];
  if (typeof sig !== 'string') throw new HttpError(400, 'NO_SIGNATURE', 'Missing signature');
  let event: Stripe.Event;
  try {
    event = stripe().webhooks.constructEvent(await rawBody(req), sig, env().STRIPE_WEBHOOK_SECRET);
  } catch {
    throw new HttpError(400, 'BAD_SIGNATURE', 'Signature check failed');
  }

  // Record first. A duplicate delivery of an already processed event is acknowledged and skipped.
  const { data: rec } = await db().from('provider_events')
    .upsert({ provider: 'stripe', event_id: event.id, event_type: event.type }, { onConflict: 'provider,event_id', ignoreDuplicates: false })
    .select('id, processed_at').single();
  if (rec?.processed_at) return { received: true, duplicate: true };

  try {
    await handle(event);
    await db().from('provider_events').update({ processed_at: new Date().toISOString(), error: null }).eq('id', rec!.id);
  } catch (e) {
    await db().from('provider_events').update({ error: String((e as Error).message).slice(0, 500) }).eq('id', rec!.id);
    throw e; // 500 makes Stripe retry
  }
  res.status(200).json({ received: true });
});

async function handle(event: Stripe.Event) {
  switch (event.type) {
    case 'checkout.session.completed':
    case 'checkout.session.async_payment_succeeded': {
      const s = event.data.object;
      if (s.mode === 'payment' && s.metadata?.order_id && s.payment_status === 'paid') {
        const pi = typeof s.payment_intent === 'string' ? s.payment_intent : s.payment_intent?.id;
        const { data: order, error } = await db().rpc('fulfil_order', { p_order: s.metadata.order_id, p_payment_intent: pi, p_amount_pence: s.amount_total });
        if (error) throw error;
        if (order.status === 'paid') await queuePaidOrderEmails(order.id);
        if (order.status === 'exception') console.error(`Order ${order.ref} needs attention: ${order.exception_reason}`);
      }
      return;
    }
    case 'checkout.session.expired': {
      const s = event.data.object;
      if (s.mode === 'payment' && s.metadata?.order_id) {
        const { data: order } = await db().from('orders').select('reservation_id').eq('id', s.metadata.order_id).single();
        if (order) await db().rpc('release_reservation', { p_reservation: order.reservation_id, p_status: 'expired' });
      }
      return;
    }
    case 'charge.refunded': {
      // Covers refunds made in the Stripe dashboard as well as ones made through the ops API.
      const charge = event.data.object;
      const pi = typeof charge.payment_intent === 'string' ? charge.payment_intent : charge.payment_intent?.id;
      if (!pi) return;
      const { data: order } = await db().from('orders').select('id').eq('stripe_payment_intent_id', pi).maybeSingle();
      if (!order) return; // not a Doorstep ticket payment
      const refunds = await stripe().refunds.list({ charge: charge.id, limit: 100 });
      for (const r of refunds.data.filter((x) => x.status === 'succeeded')) {
        const { data: updated, error } = await db().rpc('record_refund', {
          p_order: order.id, p_amount_pence: r.amount, p_reason: r.metadata?.reason || r.reason || 'Refunded in Stripe', p_stripe_refund_id: r.id, p_actor: null,
        });
        if (error) throw error;
        if (updated.status === 'refunded') await cancelPendingOrderEmails(order.id);
      }
      return;
    }
    default:
      return; // not needed
  }
}
