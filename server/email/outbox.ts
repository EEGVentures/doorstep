import { Resend } from 'resend';
import { env } from '../env.js';
import { db } from '../supabase.js';
import { isTemplate, renderEmail, type Brand } from './render.js';

export function brand(): Brand {
  const e = env();
  const assetBase = e.EMAIL_ASSET_BASE ?? `${e.SITE_URL}/email-assets`;
  return {
    site_url: e.SITE_URL,
    asset_base: assetBase,
    logo_url: `${assetBase}/doorstep-lockup-c-light.png`,
    company_legal_name: e.COMPANY_LEGAL_NAME,
    company_number: e.COMPANY_NUMBER,
    company_address: e.COMPANY_ADDRESS,
  };
}

/** Queues an email. The dedupe key makes repeats (webhook retries, double cron runs) harmless. */
export async function enqueueEmail(opts: {
  template: string;
  to: string;
  payload: Record<string, string>;
  dedupeKey: string;
  userId?: string | null;
  sendAfter?: Date;
}) {
  const { error } = await db().from('email_outbox').upsert(
    {
      template: opts.template,
      to_email: opts.to,
      user_id: opts.userId ?? null,
      payload: opts.payload,
      dedupe_key: opts.dedupeKey,
      send_after: (opts.sendAfter ?? new Date()).toISOString(),
    },
    { onConflict: 'dedupe_key', ignoreDuplicates: true },
  );
  if (error) throw error;
}

/** Sends due emails. Called by the cron tick. Returns counts for logging. */
export async function processOutbox(limit = 25) {
  const e = env();
  const resend = e.RESEND_API_KEY ? new Resend(e.RESEND_API_KEY) : null;
  const { data: due, error } = await db()
    .from('email_outbox')
    .select('id')
    .eq('status', 'queued')
    .lte('send_after', new Date().toISOString())
    .order('send_after')
    .limit(limit);
  if (error) throw error;
  let sent = 0, failed = 0, held = 0;
  for (const { id } of due ?? []) {
    // Claim the row so two overlapping ticks cannot send it twice.
    const { data: row } = await db().from('email_outbox')
      .update({ status: 'sending' }).eq('id', id).eq('status', 'queued').select('*').maybeSingle();
    if (!row) continue;
    try {
      if (!isTemplate(row.template)) throw new Error(`Unknown template ${row.template}`);
      const msg = renderEmail(row.template, row.payload, brand());
      const to = e.APP_ENV === 'production' ? row.to_email : e.EMAIL_SANDBOX_TO;
      if (!resend || !to) {
        // No key, or no sandbox inbox outside production: keep it queued for later, do not drop it.
        await db().from('email_outbox').update({ status: 'queued', last_error: 'Held: Resend not configured or no sandbox inbox' }).eq('id', id);
        held++;
        continue;
      }
      const subject = e.APP_ENV === 'production' ? msg.subject : `[${e.APP_ENV}] ${msg.subject} (for ${row.to_email})`;
      const { data, error: sendErr } = await resend.emails.send(
        { from: e.EMAIL_FROM, to, replyTo: e.EMAIL_REPLY_TO, subject, html: msg.html, text: msg.text,
          tags: [{ name: 'template', value: row.template }] },
        { idempotencyKey: `outbox-${row.id}` },
      );
      if (sendErr) throw new Error(sendErr.message);
      await db().from('email_outbox').update({
        status: 'sent', sent_at: new Date().toISOString(), resend_message_id: data?.id ?? null, attempts: row.attempts + 1, last_error: null,
      }).eq('id', id);
      sent++;
    } catch (err) {
      const attempts = row.attempts + 1;
      const giveUp = attempts >= 6;
      await db().from('email_outbox').update({
        status: giveUp ? 'failed' : 'queued',
        attempts,
        last_error: String((err as Error).message).slice(0, 500),
        send_after: new Date(Date.now() + 2 ** attempts * 60_000).toISOString(), // back off: 2, 4, 8... minutes
      }).eq('id', id);
      failed++;
    }
  }
  return { sent, failed, held };
}
