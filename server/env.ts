// Server-only configuration. Never import this from src/ (browser code).
// Anything prefixed VITE_ is bundled into the browser, so secrets never use that prefix.
import { z } from 'zod';

const schema = z.object({
  SITE_URL: z.string().url().default('http://localhost:5173'),
  APP_ENV: z.enum(['development', 'preview', 'production']).default('development'),

  SUPABASE_URL: z.string().url(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(20),

  STRIPE_SECRET_KEY: z.string().startsWith('sk_'),
  STRIPE_WEBHOOK_SECRET: z.string().startsWith('whsec_'),
  // Lookup key of the monthly membership Price (created by `npm run stripe:setup`).
  STRIPE_MEMBERSHIP_LOOKUP_KEY: z.string().default('doorstep_membership_monthly'),
  // Live keys are refused unless this is explicitly "true". Nathan switches this on, nobody else.
  ALLOW_LIVE_PAYMENTS: z.enum(['true', 'false']).default('false'),
  // Optional free trial for new members, in days (0 = none). Not decided yet.
  MEMBERSHIP_TRIAL_DAYS: z.coerce.number().int().min(0).max(90).default(0),
  // Days of continued access while a failed renewal is retried.
  MEMBERSHIP_GRACE_DAYS: z.coerce.number().int().min(0).max(30).default(7),

  RESEND_API_KEY: z.string().startsWith('re_').optional(),
  EMAIL_FROM: z.string().default('Doorstep <tickets@send.doorstep.live>'),
  EMAIL_REPLY_TO: z.string().default('support@doorstep.live'),
  // Outside production, every customer email is redirected here instead.
  EMAIL_SANDBOX_TO: z.string().email().optional(),
  EMAIL_ASSET_BASE: z.string().url().optional(),
  COMPANY_LEGAL_NAME: z.string().default('[Company legal name TBC]'),
  COMPANY_NUMBER: z.string().default('[Company number TBC]'),
  COMPANY_ADDRESS: z.string().default('[Registered address TBC]'),

  // Close-off reports: venues only receive them when this is "true" AND the venue is enabled.
  CLOSEOFF_LIVE_SENDING: z.enum(['true', 'false']).default('false'),
  CLOSEOFF_TEST_RECIPIENT: z.string().email().optional(),

  CRON_SECRET: z.string().min(16),

  APPLE_BUNDLE_ID: z.string().default('live.doorstep.app'),
  APPLE_APP_ID: z.coerce.number().optional(),
  APPLE_ENVIRONMENT: z.enum(['Sandbox', 'Production']).default('Sandbox'),
  APPLE_MEMBERSHIP_PRODUCT_ID: z.string().default('live.doorstep.membership.monthly'),
});

export type Env = z.infer<typeof schema>;
let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const missing = parsed.error.issues.map((i) => i.path.join('.')).join(', ');
    throw new Error(`Server configuration is incomplete: ${missing}`);
  }
  const e = parsed.data;
  if (e.STRIPE_SECRET_KEY.startsWith('sk_live_') && e.ALLOW_LIVE_PAYMENTS !== 'true') {
    throw new Error('Live Stripe key found but ALLOW_LIVE_PAYMENTS is not "true". Use test keys until Nathan approves live billing.');
  }
  cached = e;
  return e;
}

/** For tests only. */
export function resetEnvCache() {
  cached = undefined;
}
