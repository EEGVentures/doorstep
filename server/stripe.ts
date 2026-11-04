import Stripe from 'stripe';
import { env } from './env.js';
import { db, type Profile } from './supabase.js';

let client: Stripe | undefined;
export function stripe(): Stripe {
  if (!client) client = new Stripe(env().STRIPE_SECRET_KEY, { appInfo: { name: 'Doorstep' } });
  return client;
}

/** Finds or creates the Stripe customer for a profile and stores the id. */
export async function ensureCustomer(user: Profile): Promise<string> {
  if (user.stripe_customer_id) return user.stripe_customer_id;
  const customer = await stripe().customers.create(
    {
      email: user.email,
      name: [user.first_name, user.last_name].filter(Boolean).join(' ') || undefined,
      metadata: { user_id: user.id },
    },
    { idempotencyKey: `customer-${user.id}` },
  );
  // Only set it if nobody else did in the meantime.
  await db().from('profiles').update({ stripe_customer_id: customer.id }).eq('id', user.id).is('stripe_customer_id', null);
  const { data } = await db().from('profiles').select('stripe_customer_id').eq('id', user.id).single();
  return data?.stripe_customer_id ?? customer.id;
}

let membershipPrice: Stripe.Price | undefined;
/** The monthly membership price, found by lookup key so the code never hard-codes a price id or amount. */
export async function getMembershipPrice(): Promise<Stripe.Price> {
  if (membershipPrice) return membershipPrice;
  const { data } = await stripe().prices.list({ lookup_keys: [env().STRIPE_MEMBERSHIP_LOOKUP_KEY], active: true, limit: 1 });
  if (!data[0]) throw new Error(`No active Stripe price with lookup key ${env().STRIPE_MEMBERSHIP_LOOKUP_KEY}. Run npm run stripe:setup.`);
  membershipPrice = data[0];
  return membershipPrice;
}

export function formatPence(pence: number) {
  return `£${(pence / 100).toFixed(2)}`;
}
