// Membership entitlement: one record per subscription, whichever store sold it.
// Web members come from Stripe Billing, iOS members from App Store in-app purchase (docs/08 section 3).
// Both feed membership_entitlements, which public.has_active_membership() reads at checkout.
import type Stripe from 'stripe';

export type EntitlementStatus =
  | 'trialing' | 'active' | 'past_due' | 'in_grace' | 'canceled' | 'expired' | 'incomplete' | 'paused';

export type EntitlementUpsert = {
  user_id: string;
  source: 'stripe' | 'apple' | 'comp';
  provider_ref: string;
  status: EntitlementStatus;
  product_ref: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  grace_until: string | null;
};

const iso = (unixSeconds: number | null | undefined) =>
  unixSeconds ? new Date(unixSeconds * 1000).toISOString() : null;

/** Maps a Stripe subscription (fetched fresh from Stripe, never trusted from the payload) to an entitlement. */
export function entitlementFromStripe(sub: Stripe.Subscription, userId: string, graceDays: number): EntitlementUpsert {
  const map: Record<Stripe.Subscription.Status, EntitlementStatus> = {
    trialing: 'trialing',
    active: 'active',
    past_due: 'past_due',
    unpaid: 'expired',
    canceled: 'canceled',
    incomplete: 'incomplete',
    incomplete_expired: 'expired',
    paused: 'paused',
  };
  const status = map[sub.status];
  let periodEnd = sub.current_period_end;
  // Cancelled straight away (not at period end): access stops when it ended, not at the paid-up date.
  if (sub.status === 'canceled' && sub.ended_at) periodEnd = Math.min(periodEnd, sub.ended_at);
  const grace = status === 'past_due' ? iso(sub.current_period_end + graceDays * 86400) : null;
  return {
    user_id: userId,
    source: 'stripe',
    provider_ref: sub.id,
    status,
    product_ref: sub.items.data[0]?.price.id ?? null,
    current_period_end: iso(periodEnd),
    cancel_at_period_end: sub.cancel_at_period_end,
    grace_until: grace,
  };
}

// --- Apple App Store Server Notifications V2 --------------------------------
// Shapes are the decoded JWS payloads from @apple/app-store-server-library.
export type AppleTransaction = {
  originalTransactionId?: string;
  productId?: string;
  expiresDate?: number;      // ms
  revocationDate?: number;   // ms
  appAccountToken?: string;  // the Supabase user id, set by the app at purchase
};
export type AppleRenewalInfo = { autoRenewStatus?: number; gracePeriodExpiresDate?: number };

/** Returns the new entitlement, or null when the notification does not change access. */
export function entitlementFromApple(
  notificationType: string,
  subtype: string | undefined,
  tx: AppleTransaction,
  renewal: AppleRenewalInfo | undefined,
  previous?: Pick<EntitlementUpsert, 'status' | 'current_period_end'>,
): EntitlementUpsert | null {
  if (!tx.originalTransactionId || !tx.appAccountToken) return null;
  const msIso = (ms?: number) => (ms ? new Date(ms).toISOString() : null);
  const base: EntitlementUpsert = {
    user_id: tx.appAccountToken,
    source: 'apple',
    provider_ref: tx.originalTransactionId,
    status: 'active',
    product_ref: tx.productId ?? null,
    current_period_end: msIso(tx.expiresDate),
    cancel_at_period_end: renewal?.autoRenewStatus === 0,
    grace_until: null,
  };
  switch (notificationType) {
    case 'SUBSCRIBED':
    case 'DID_RENEW':
    case 'OFFER_REDEEMED':
    case 'DID_CHANGE_RENEWAL_PREF':
    case 'RENEWAL_EXTENDED':
      return base;
    case 'DID_CHANGE_RENEWAL_STATUS':
      return { ...base, status: previous?.status ?? 'active' };
    case 'DID_FAIL_TO_RENEW':
      return subtype === 'GRACE_PERIOD'
        ? { ...base, status: 'in_grace', grace_until: msIso(renewal?.gracePeriodExpiresDate) }
        : { ...base, status: 'past_due', grace_until: null };
    case 'GRACE_PERIOD_EXPIRED':
    case 'EXPIRED':
      return { ...base, status: 'expired' };
    case 'REFUND':
    case 'REVOKE':
      return { ...base, status: 'expired', current_period_end: msIso(tx.revocationDate) ?? new Date().toISOString() };
    default:
      return null;
  }
}
