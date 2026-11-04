// POST /api/membership { action: "join" | "manage" | "status" }
// join:   Stripe Billing checkout for the monthly membership (web only; iOS uses in-app purchase).
// manage: Stripe customer portal, where members update cards or cancel in a couple of clicks (UK subscription rules).
// status: the member's current entitlement and the public price.
import { z } from 'zod';
import { env } from '../server/env.js';
import { bodyOf, handler, HttpError } from '../server/http.js';
import { ensureCustomer, getMembershipPrice, stripe } from '../server/stripe.js';
import { db, requireUser } from '../server/supabase.js';

const Body = z.object({ action: z.enum(['join', 'manage', 'status']) });

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const { action } = bodyOf(req, Body.parse);
  const site = env().SITE_URL;

  const { data: active } = await db().rpc('has_active_membership', { p_user: user.id });

  if (action === 'status') {
    const price = await getMembershipPrice();
    const { data: ent } = await db().from('membership_entitlements')
      .select('source, status, current_period_end, cancel_at_period_end, grace_until')
      .eq('user_id', user.id).order('updated_at', { ascending: false }).limit(1).maybeSingle();
    return {
      active: Boolean(active),
      entitlement: ent,
      price: { amount_pence: price.unit_amount, interval: price.recurring?.interval ?? 'month' },
      trialDays: env().MEMBERSHIP_TRIAL_DAYS,
    };
  }

  if (action === 'manage') {
    if (!user.stripe_customer_id) throw new HttpError(404, 'NO_BILLING', 'There is no web membership on this account. If you joined in the iPhone app, manage it in your Apple account settings.');
    const portal = await stripe().billingPortal.sessions.create({ customer: user.stripe_customer_id, return_url: `${site}/account` });
    return { url: portal.url };
  }

  // join
  if (active) throw new HttpError(409, 'ALREADY_MEMBER', 'You are already a member.');
  const price = await getMembershipPrice();
  const customer = await ensureCustomer(user);
  const trial = env().MEMBERSHIP_TRIAL_DAYS;
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    client_reference_id: user.id,
    line_items: [{ price: price.id, quantity: 1 }],
    subscription_data: { metadata: { user_id: user.id }, ...(trial > 0 ? { trial_period_days: trial } : {}) },
    metadata: { user_id: user.id, kind: 'membership' },
    success_url: `${site}/account?joined=1`,
    cancel_url: `${site}/join?cancelled=1`,
    allow_promotion_codes: true,
  });
  return { url: session.url };
});
