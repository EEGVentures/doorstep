import { Resend } from 'resend';
import { env } from './env.js';
import { db } from './supabase.js';
import { buildCsv, countsByType, dueSlot, localIso, scheduleSlots, selectRows, slotKey, type TicketRow } from './closeoff.js';

const intervalMs = (pg: string) => {
  // Postgres interval text such as "48:00:00", "04:00:00", "00:30:00" or "2 days".
  const days = /(\d+) days?/.exec(pg)?.[1];
  const hms = /(\d+):(\d+):(\d+)/.exec(pg);
  return (Number(days ?? 0) * 86400 + (hms ? Number(hms[1]) * 3600 + Number(hms[2]) * 60 + Number(hms[3]) : 0)) * 1000;
};

/** Generates and delivers any close-off report that is due. Idempotent per event and slot. */
export async function runCloseoffs(now = new Date()) {
  const e = env();
  const horizon = new Date(now.getTime() + 49 * 3600_000).toISOString();
  const { data: events, error } = await db()
    .from('events')
    .select('id, title, doors_at, status, closeoff_final_lead, closeoff_recipients_override, venue:venues(id, name, timezone, settings:venue_closeoff_settings(*))')
    .in('status', ['on_sale', 'sold_out', 'sales_closed'])
    .gt('doors_at', now.toISOString())
    .lte('doors_at', horizon);
  if (error) throw error;
  const results: { event: string; slot?: string; version?: number; status: string }[] = [];

  for (const ev of events ?? []) {
    const venue = ev.venue as unknown as { id: string; name: string; timezone: string; settings: Record<string, string | boolean | string[]> | null };
    const st = venue.settings ?? {};
    const schedule = {
      previewLeadMs: intervalMs(String(st.preview_lead ?? '48:00:00')),
      finalLeadMs: intervalMs(String(ev.closeoff_final_lead ?? st.final_lead ?? '04:00:00')),
      revisionEveryMs: intervalMs(String(st.revision_every ?? '00:30:00')),
      revisionStopLeadMs: intervalMs(String(st.revision_stop_lead ?? '00:30:00')),
    };
    const doors = new Date(ev.doors_at);
    const { data: existing } = await db().from('closeoff_reports').select('id, kind, slot_at, version').eq('event_id', ev.id).order('version');
    const done = new Set((existing ?? []).map((r) => slotKey({ kind: r.kind, at: new Date(r.slot_at) })));
    const slot = dueSlot(now, doors, scheduleSlots(doors, schedule), done);
    if (!slot) continue;

    // Every ticket for the event, valid or revoked, with its code (service role reads before the reveal).
    const { data: tix, error: tErr } = await db()
      .from('tickets')
      .select('id, status, issued_at, holder_first_name, holder_last_name, barcode:ticket_barcodes(barcode), order:orders(ref, unit_price_pence, ticket_type_name)')
      .eq('event_id', ev.id);
    if (tErr) throw tErr;
    const current: TicketRow[] = (tix ?? []).map((t: any) => ({
      ticket_id: t.id, barcode: t.barcode?.barcode, status: t.status, issued_at: t.issued_at,
      holder_first_name: t.holder_first_name, holder_last_name: t.holder_last_name,
      order_ref: t.order.ref, unit_price_pence: t.order.unit_price_pence, ticket_type: t.order.ticket_type_name,
    }));
    if (current.every((t) => t.status === 'revoked') && !(existing ?? []).length) continue; // nothing ever sold

    // Last status we told the venue about, per ticket.
    const lastSent = new Map<string, 'valid' | 'revoked'>();
    if (existing?.length) {
      const { data: items } = await db().from('closeoff_report_items')
        .select('ticket_id, status, report:closeoff_reports!inner(version, event_id)')
        .eq('report.event_id', ev.id);
      for (const it of (items ?? []).sort((a: any, b: any) => a.report.version - b.report.version)) lastSent.set(it.ticket_id, it.status);
    }
    const picked = selectRows(slot.kind, current, lastSent);
    if (slot.kind === 'revision' && picked.rows.length === 0) continue; // revisions only when something changed

    const version = (existing?.at(-1)?.version ?? 0) + 1;
    const { csv, sha256 } = buildCsv(picked.rows, { id: ev.id, title: ev.title, venue_name: venue.name, doors_at: doors, timezone: venue.timezone }, version);
    const live = e.CLOSEOFF_LIVE_SENDING === 'true' && st.sending_enabled === true;
    const recipients = live ? (ev.closeoff_recipients_override ?? (st.recipients as string[]) ?? []) : (e.CLOSEOFF_TEST_RECIPIENT ? [e.CLOSEOFF_TEST_RECIPIENT] : []);

    const { data: report, error: rErr } = await db().from('closeoff_reports').insert({
      event_id: ev.id, version, kind: slot.kind, slot_at: slot.at.toISOString(), row_count: picked.rows.length,
      valid_total: picked.validTotal, added_count: picked.added, revoked_count: picked.revoked, csv, sha256, recipients,
      delivery_status: recipients.length ? 'pending' : 'skipped_disabled',
    }).select('id').single();
    if (rErr) {
      // A parallel tick got there first (unique event+slot or event+version). Safe to skip.
      if (rErr.code === '23505') { results.push({ event: ev.title, slot: slotKey(slot), status: 'duplicate-skipped' }); continue; }
      throw rErr;
    }
    if (picked.rows.length) {
      await db().from('closeoff_report_items').insert(picked.rows.map((r) => ({ report_id: report.id, ticket_id: r.ticket_id, status: r.status })));
    }
    if (!recipients.length) { results.push({ event: ev.title, slot: slotKey(slot), version, status: 'no-recipient' }); continue; }

    const delivery = await deliver({ ev, venueName: venue.name, timezone: venue.timezone, doors, version, kind: slot.kind, csv, picked, recipients, live });
    await db().from('closeoff_reports').update(delivery).eq('id', report.id);
    results.push({ event: ev.title, slot: slotKey(slot), version, status: delivery.delivery_status });
  }
  return results;
}

async function deliver(a: {
  ev: { id: string; title: string }; venueName: string; timezone: string; doors: Date; version: number; kind: string;
  csv: string; picked: ReturnType<typeof selectRows>; recipients: string[]; live: boolean;
}) {
  const e = env();
  if (!e.RESEND_API_KEY) return { delivery_status: 'failed' as const, delivery_error: 'RESEND_API_KEY not set' };
  const doorsLocal = localIso(a.doors, a.timezone);
  const label = a.kind === 'revision' ? `Revision v${a.version}` : a.kind === 'final' ? `Final close-off v${a.version}` : `Preview v${a.version}`;
  const byType = countsByType(a.picked.rows).map(([t, n]) => `<li>${t}: ${n}</li>`).join('');
  const html = `<p>${a.live ? '' : '<strong>TEST MODE: internal recipient only. Not sent to the venue.</strong></p><p>'}
${label} for <strong>${a.ev.title}</strong> at ${a.venueName}.</p>
<ul><li>Doors: ${doorsLocal}</li><li>Report version: ${a.version}</li><li>Total valid tickets: ${a.picked.validTotal}</li>
<li>Added since last version: ${a.picked.added}</li><li>Revoked since last version: ${a.picked.revoked}</li></ul>
<p>Valid tickets in this file by type:</p><ul>${byType || '<li>None</li>'}</ul>
<p>Import the attached CSV into your scanner as usual. Barcodes are QR codes carrying the <code>barcode</code> value. Rows marked <code>revoked</code> must be refused at the door.</p>
<p>Please reply to confirm the import. Doorstep operations</p>`;
  const resend = new Resend(e.RESEND_API_KEY);
  const filename = `doorstep-closeoff-${a.ev.id.slice(0, 8)}-v${a.version}.csv`;
  const { data, error } = await resend.emails.send(
    {
      from: e.EMAIL_FROM, to: a.recipients, replyTo: 'partners@doorstep.live',
      subject: `${a.live ? '' : '[TEST] '}${label}: ${a.ev.title}, ${a.picked.validTotal} tickets`,
      html, attachments: [{ filename, content: Buffer.from(a.csv).toString('base64') }],
    },
    { idempotencyKey: `closeoff-${a.ev.id}-v${a.version}` },
  );
  if (error) return { delivery_status: 'failed' as const, delivery_error: error.message };
  return {
    delivery_status: a.live ? ('sent' as const) : ('held_test_mode' as const),
    delivered_at: new Date().toISOString(),
    resend_message_id: data?.id ?? null,
  };
}
