// POST /api/webhooks/apple  (App Store Server Notifications V2)
// Feeds iOS in-app purchase memberships into the same entitlement table as Stripe (docs/08 section 3).
// The iOS app must set appAccountToken = the Supabase user id when it starts a purchase.
// Needs APPLE_ROOT_CA_G3_BASE64 (Apple Root CA G3 certificate, DER, base64) from apple.com/certificateauthority.
import { Environment, SignedDataVerifier } from '@apple/app-store-server-library';
import { env } from '../../server/env.js';
import { bodyOf, handler, HttpError } from '../../server/http.js';
import { db } from '../../server/supabase.js';
import { entitlementFromApple } from '../../server/membership.js';
import { upsertEntitlement } from '../../server/membership-sync.js';
import { z } from 'zod';

let verifier: SignedDataVerifier | undefined;
function getVerifier() {
  if (verifier) return verifier;
  const root = process.env.APPLE_ROOT_CA_G3_BASE64;
  if (!root) throw new HttpError(503, 'APPLE_NOT_CONFIGURED', 'Apple notifications are not configured yet.', true);
  const e = env();
  verifier = new SignedDataVerifier(
    [Buffer.from(root, 'base64')],
    true,
    e.APPLE_ENVIRONMENT === 'Production' ? Environment.PRODUCTION : Environment.SANDBOX,
    e.APPLE_BUNDLE_ID,
    e.APPLE_APP_ID,
  );
  return verifier;
}

export default handler(['POST'], async (req) => {
  const { signedPayload } = bodyOf(req, z.object({ signedPayload: z.string().min(10) }).parse);
  const v = getVerifier();
  let n;
  try {
    n = await v.verifyAndDecodeNotification(signedPayload);
  } catch {
    throw new HttpError(400, 'BAD_SIGNATURE', 'Notification failed verification');
  }
  if (!n.notificationUUID) throw new HttpError(400, 'NO_ID', 'Notification has no id');

  const { data: rec } = await db().from('provider_events')
    .upsert({ provider: 'apple', event_id: n.notificationUUID, event_type: `${n.notificationType}${n.subtype ? `/${n.subtype}` : ''}` }, { onConflict: 'provider,event_id' })
    .select('id, processed_at').single();
  if (rec?.processed_at) return { received: true, duplicate: true };

  const tx = n.data?.signedTransactionInfo ? await v.verifyAndDecodeTransaction(n.data.signedTransactionInfo) : undefined;
  const renewal = n.data?.signedRenewalInfo ? await v.verifyAndDecodeRenewalInfo(n.data.signedRenewalInfo) : undefined;
  if (tx && tx.productId === env().APPLE_MEMBERSHIP_PRODUCT_ID) {
    const { data: prev } = await db().from('membership_entitlements')
      .select('status, current_period_end').eq('source', 'apple').eq('provider_ref', tx.originalTransactionId ?? '').maybeSingle();
    const ent = entitlementFromApple(String(n.notificationType), n.subtype ? String(n.subtype) : undefined, tx, renewal, prev ?? undefined);
    if (ent) await upsertEntitlement(ent, new Date(n.signedDate ?? Date.now()));
  }
  await db().from('provider_events').update({ processed_at: new Date().toISOString() }).eq('id', rec!.id);
  return { received: true };
});
