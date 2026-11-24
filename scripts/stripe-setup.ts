// One-off Stripe setup in TEST mode: the webhook endpoint for ticket payments. No subscriptions (model change, 24 Nov 2026).
// Safe to run again: it finds an existing endpoint by URL and updates its events.
// Usage: STRIPE_SECRET_KEY=sk_test_... SITE_URL=https://<stable test URL> npm run stripe:setup
import Stripe from 'stripe';

const key = process.env.STRIPE_SECRET_KEY ?? '';
if (!key.startsWith('sk_test_')) {
  console.error('Refusing to run: STRIPE_SECRET_KEY must be a TEST key (sk_test_...). Live setup is a separate, approved step.');
  process.exit(1);
}
const site = process.env.SITE_URL;
const stripe = new Stripe(key);

if (site) {
  const url = `${site.replace(/\/$/, '')}/api/webhooks/stripe`;
  const events: Stripe.WebhookEndpointCreateParams.EnabledEvent[] = [
    'checkout.session.completed', 'checkout.session.async_payment_succeeded', 'checkout.session.expired',
    'charge.refunded',
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
