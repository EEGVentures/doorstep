import { describe, expect, it } from 'vitest';
import type Stripe from 'stripe';
import { entitlementFromApple, entitlementFromStripe } from '../../server/membership.js';

const sub = (o: Partial<Stripe.Subscription>) => ({
  id: 'sub_1', status: 'active', current_period_end: 1_800_000_000, cancel_at_period_end: false, ended_at: null,
  items: { data: [{ price: { id: 'price_1' } }] }, ...o,
}) as unknown as Stripe.Subscription;

describe('Stripe subscription to entitlement', () => {
  it('active', () => {
    expect(entitlementFromStripe(sub({}), 'u1', 7)).toMatchObject({ status: 'active', source: 'stripe', provider_ref: 'sub_1', product_ref: 'price_1', grace_until: null });
  });
  it('past_due gets a grace window after the period end', () => {
    const e = entitlementFromStripe(sub({ status: 'past_due' }), 'u1', 7);
    expect(e.status).toBe('past_due');
    expect(e.grace_until).toBe(new Date((1_800_000_000 + 7 * 86400) * 1000).toISOString());
  });
  it('cancelled immediately ends access at ended_at, not the paid-up date', () => {
    const e = entitlementFromStripe(sub({ status: 'canceled', ended_at: 1_799_000_000 }), 'u1', 7);
    expect(e.current_period_end).toBe(new Date(1_799_000_000 * 1000).toISOString());
  });
  it('unpaid and incomplete_expired mean no access', () => {
    expect(entitlementFromStripe(sub({ status: 'unpaid' }), 'u1', 7).status).toBe('expired');
    expect(entitlementFromStripe(sub({ status: 'incomplete_expired' }), 'u1', 7).status).toBe('expired');
  });
});

describe('Apple notification to entitlement', () => {
  const tx = { originalTransactionId: 'otx1', productId: 'live.doorstep.membership.monthly', expiresDate: 1_800_000_000_000, appAccountToken: 'user-uuid' };
  it('subscribe and renew are active', () => {
    expect(entitlementFromApple('SUBSCRIBED', 'INITIAL_BUY', tx, { autoRenewStatus: 1 })).toMatchObject({ status: 'active', user_id: 'user-uuid', source: 'apple' });
    expect(entitlementFromApple('DID_RENEW', undefined, tx, undefined)?.status).toBe('active');
  });
  it('turning off auto-renew keeps access, flags cancel at period end', () => {
    expect(entitlementFromApple('DID_CHANGE_RENEWAL_STATUS', 'AUTO_RENEW_DISABLED', tx, { autoRenewStatus: 0 }, { status: 'active', current_period_end: null }))
      .toMatchObject({ status: 'active', cancel_at_period_end: true });
  });
  it('billing grace period vs billing retry', () => {
    expect(entitlementFromApple('DID_FAIL_TO_RENEW', 'GRACE_PERIOD', tx, { gracePeriodExpiresDate: 1_800_100_000_000 }))
      .toMatchObject({ status: 'in_grace', grace_until: new Date(1_800_100_000_000).toISOString() });
    expect(entitlementFromApple('DID_FAIL_TO_RENEW', undefined, tx, undefined)?.status).toBe('past_due');
  });
  it('refund and revoke end access at the revocation time', () => {
    expect(entitlementFromApple('REFUND', undefined, { ...tx, revocationDate: 1_790_000_000_000 }, undefined))
      .toMatchObject({ status: 'expired', current_period_end: new Date(1_790_000_000_000).toISOString() });
  });
  it('ignores purchases with no linked Doorstep account', () => {
    expect(entitlementFromApple('SUBSCRIBED', undefined, { ...tx, appAccountToken: undefined }, undefined)).toBeNull();
  });
});
