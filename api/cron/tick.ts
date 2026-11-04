// GET /api/cron/tick  (Vercel Cron, every 5 minutes; needs the Pro plan for sub-daily schedules)
// Expires stale holds, sends due emails and produces any close-off report that is due.
import { env } from '../../server/env.js';
import { handler, HttpError } from '../../server/http.js';
import { db } from '../../server/supabase.js';
import { processOutbox } from '../../server/email/outbox.js';
import { runCloseoffs } from '../../server/closeoff-runner.js';

export default handler(['GET'], async (req) => {
  // Vercel sends "Authorization: Bearer <CRON_SECRET>" on cron calls.
  if (req.headers.authorization !== `Bearer ${env().CRON_SECRET}`) throw new HttpError(401, 'UNAUTHORISED', 'Not allowed');
  const out: Record<string, unknown> = {};
  const { data: expired, error } = await db().rpc('expire_stale_reservations');
  if (error) throw error;
  out.expiredHolds = expired;
  out.closeoffs = await runCloseoffs();
  out.email = await processOutbox();
  console.log('tick', JSON.stringify(out));
  return out;
});
