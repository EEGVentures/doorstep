// POST /api/me { marketingEmail: boolean, source }  Records consent as an append-only event.
import { z } from 'zod';
import { bodyOf, handler } from '../server/http.js';
import { db, requireUser } from '../server/supabase.js';

const POLICY_VERSION = '2026-11-draft';

export default handler(['POST'], async (req) => {
  const user = await requireUser(req);
  const b = bodyOf(req, z.object({ marketingEmail: z.boolean(), source: z.enum(['signup', 'account', 'affiliate_checkout']) }).parse);
  await db().from('consent_events').insert({
    user_id: user.id, channel: 'email', purpose: 'marketing', action: b.marketingEmail ? 'granted' : 'withdrawn',
    policy_version: POLICY_VERSION, source: b.source,
  });
  await db().from('profiles').update({ marketing_email_consent: b.marketingEmail }).eq('id', user.id);
  return { marketingEmail: b.marketingEmail };
});
