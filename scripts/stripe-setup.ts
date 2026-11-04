// One-off Stripe setup in TEST mode: membership product + monthly price, customer portal, webhook endpoint.
// Safe to run again: it finds what already exists by lookup key / URL.
// Usage: STRIPE_SECRET_KEY=sk_test_... MEMBERSHIP_PRICE_PENCE=499 SITE_URL=https://<preview>.vercel.app npm run stripe:setup
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Live setup is a separate, approved step.');
  process.exit(1);
}
const pricePence = Number(process.env.MEMBERSHIP_PRICE_PENCE);
if (!Number.isInteger(pricePence) || pricePence <= 0) {
  console.error('Set MEMBERSHIP_PRICE_PENCE (the monthly price in pence, e.g. 499). The real price is still to be decided; any test value works.');
  process.exit(1);
}
const site = process.env.SITE_URL;
const lookupKey = process.env.STRIPE_MEMBERSHIP_LOOKUP_KEY ?? 'doorstep_membership_monthly';
const stripe = new Stripe(key);

const existing = await stripe.prices.list({ lookup_keys: [lookupKey], limit: 1, expand: ['data.product'] });
let price = existing.data[0];
if (price && price.unit_amount !== pricePence) {
  // Prices are immutable in Stripe: make a new one and move the lookup key across.
  console.log(`Existing price is ${price.unit_amount}p; creating a new ${pricePence}p price and moving the lookup key.`);
  price = await stripe.prices.create({
    product: typeof price.product === 'string' ? price.product : price.product.id,
    currency: 'gbp', unit_amount: pricePence, recurring: { interval: 'month' }, lookup_key: lookupKey, transfer_lookup_key: true,
  });
}
if (!price) {
  const product = await stripe.products.create({
    name: 'Doorstep membership',
    description: 'Monthly membership. Lets you book tickets on Doorstep.',
    metadata: { doorstep: 'membership' },
  });
  price = await stripe.prices.create({ product: product.id, currency: 'gbp', unit_amount: pricePence, recurring: { interval: 'month' }, lookup_key: lookupKey });
}
console.log(`Membership price: ${price.id} (${price.unit_amount}p/month, lookup key ${lookupKey})`);

// Customer portal: members can update their card and cancel online without contacting us (UK subscription rules).
const portal = await stripe.billingPortal.configurations.create({
  business_profile: { headline: 'Manage your Doorstep membership', privacy_policy_url: site ? `${site}/legal/privacy` : undefined, terms_of_service_url: site ? `${site}/legal/terms` : undefined },
  features: {
    payment_method_update: { enabled: true },
    invoice_history: { enabled: true },
    subscription_cancel: { enabled: true, mode: 'at_period_end', cancellation_reason: { enabled: true, options: ['too_expensive', 'unused', 'other'] } },
  },
  default_return_url: site ? `${site}/account` : undefined,
});
await stripe.billingPortal.configurations.update(portal.id, { active: true });
console.log(`Customer portal configuration: ${portal.id}`);

if (site) {
  const url = `${site.replace(/\/$/, '')}/api/webhooks/stripe`;
  const events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired',
    'customer.subscription.created', 'customer.subscription.updated', 'customer.subscription.deleted',
    'customer.subscription.paused', 'customer.subscription.resumed',
    'invoice.paid', 'invoice.payment_failed', 'invoice.upcoming', 'charge.refunded',
  ];
  const hooks = await stripe.webhookEndpoints.list({ limit: 100 });
  const found = hooks.data.find((h) => h.url === url);
  if (found) {
    await stripe.webhookEndpoints.update(found.id, { enabled_events: events });
    console.log(`Webhook already exists: ${found.id}. Its signing secret is in the Stripe dashboard.`);
  } else {
    const hook = await stripe.webhookEndpoints.create({ url, enabled_events: events, api_version: '2025-02-24.acacia', description: 'Doorstep' });
    console.log(`Webhook created: ${hook.id}\nSet STRIPE_WEBHOOK_SECRET=${hook.secret} in Vercel (Preview environment).`);
  }
} else {
  console.log('No SITE_URL given, so no webhook was created. For local work use: stripe listen --forward-to localhost:3000/api/webhooks/stripe');
}
