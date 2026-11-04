// Venue close-off reports in the one standard Doorstep CSV format (docs/08 section 5a).
// Pure functions first (schedule, diff, CSV) so they can be unit-tested, then the runner.
import { createHash } from 'node:crypto';

export const CLOSEOFF_HEADER = [
  'barcode', 'status', 'event_id', 'event_name', 'venue_name', 'doors_local', 'ticket_type',
  'ticket_price', 'order_ref', 'holder_first_name', 'holder_last_name', 'issued_at', 'report_version',
] as const;

export type Kind = 'preview' | 'final' | 'revision';
export type Slot = { kind: Kind; at: Date };

export type Schedule = {
  previewLeadMs: number;      // default 48h
  finalLeadMs: number;        // default 4h
  revisionEveryMs: number;    // default 30m
  revisionStopLeadMs: number; // default 30m
};

/** Every slot for an event, in time order. Times are absolute instants, so clock changes are handled by the instant itself. */
export function scheduleSlots(doorsAt: Date, s: Schedule): Slot[] {
  const doors = doorsAt.getTime();
  const slots: Slot[] = [
    { kind: 'preview', at: new Date(doors - s.previewLeadMs) },
    { kind: 'final', at: new Date(doors - s.finalLeadMs) },
  ];
  const stop = doors - s.revisionStopLeadMs;
  for (let t = doors - s.finalLeadMs + s.revisionEveryMs; t <= stop; t += s.revisionEveryMs) {
    slots.push({ kind: 'revision', at: new Date(t) });
  }
  return slots;
}

/**
 * The slot to run now, or null. Rules:
 * - only the most recent slot whose time has come (a missed earlier slot is superseded, never back-filled)
 * - nothing after doors
 * - a slot that already has a report is done
 */
export function dueSlot(now: Date, doorsAt: Date, slots: Slot[], done: Set<string>): Slot | null {
  if (now.getTime() >= doorsAt.getTime()) return null;
  const past = slots.filter((s) => s.at.getTime() <= now.getTime());
  const latest = past[past.length - 1];
  if (!latest) return null;
  return done.has(slotKey(latest)) ? null : latest;
}
export const slotKey = (s: Slot) => `${s.kind}@${s.at.toISOString()}`;

export type TicketRow = {
  ticket_id: string;
  barcode: string;
  status: 'valid' | 'revoked';
  ticket_type: string;
  unit_price_pence: number;
  order_ref: string;
  holder_first_name: string | null;
  holder_last_name: string | null;
  issued_at: string;
};

/**
 * Which rows go in this report.
 * Full reports (preview, final): every valid ticket, plus revoked rows for tickets a previous report sent as valid,
 * so a venue that loaded the preview also learns about refunds.
 * Revision: only tickets whose status changed since the last report.
 */
export function selectRows(kind: Kind, current: TicketRow[], lastSent: Map<string, 'valid' | 'revoked'>) {
  const added = current.filter((t) => t.status === 'valid' && lastSent.get(t.ticket_id) !== 'valid');
  const revoked = current.filter((t) => t.status === 'revoked' && lastSent.get(t.ticket_id) === 'valid');
  const rows = kind === 'revision' ? [...added, ...revoked] : [...current.filter((t) => t.status === 'valid'), ...revoked];
  return { rows, added: added.length, revoked: revoked.length, validTotal: current.filter((t) => t.status === 'valid').length };
}

/** ISO 8601 with the venue's UTC offset, e.g. 2027-02-12T19:00:00+00:00 (GMT) or 2027-06-12T19:00:00+01:00 (BST). */
export function localIso(d: Date, timeZone: string) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-GB', {
      timeZone, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit',
      hourCycle: 'h23', timeZoneName: 'longOffset',
    }).formatToParts(d).map((p) => [p.type, p.value]),
  );
  const offset = (parts.timeZoneName as string).replace('GMT', '') || '+00:00';
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}:${parts.second}${offset}`;
}

const q = (v: string | number | null | undefined) => `"${String(v ?? '').replace(/"/g, '""')}"`;

export function buildCsv(
  rows: TicketRow[],
  ev: { id: string; title: string; venue_name: string; doors_at: Date; timezone: string },
  version: number,
) {
  const lines = [CLOSEOFF_HEADER.join(',')];
  for (const t of rows) {
    lines.push([
      t.barcode, t.status, ev.id, ev.title, ev.venue_name, localIso(ev.doors_at, ev.timezone), t.ticket_type,
      (t.unit_price_pence / 100).toFixed(2), t.order_ref, t.holder_first_name, t.holder_last_name,
      new Date(t.issued_at).toISOString(), version,
    ].map(q).join(','));
  }
  const csv = lines.join('\r\n') + '\r\n';
  return { csv, sha256: createHash('sha256').update(csv).digest('hex') };
}

export function countsByType(rows: TicketRow[]) {
  const m = new Map<string, number>();
  for (const r of rows) if (r.status === 'valid') m.set(r.ticket_type, (m.get(r.ticket_type) ?? 0) + 1);
  return [...m.entries()];
}
