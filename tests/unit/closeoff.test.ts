import { describe, expect, it } from 'vitest';
import { buildCsv, CLOSEOFF_HEADER, dueSlot, localIso, scheduleSlots, selectRows, slotKey, type TicketRow } from '../../server/closeoff.js';

const H = 3600_000, M = 60_000;
const sched = { previewLeadMs: 48 * H, finalLeadMs: 4 * H, revisionEveryMs: 30 * M, revisionStopLeadMs: 30 * M };

describe('close-off schedule (Tramshed defaults)', () => {
  const doors = new Date('2027-02-12T19:00:00Z');
  const slots = scheduleSlots(doors, sched);
  it('preview at doors minus 48h, final at minus 4h, revisions every 30m until minus 30m', () => {
    expect(slots[0]).toEqual({ kind: 'preview', at: new Date('2027-02-10T19:00:00Z') });
    expect(slots[1]).toEqual({ kind: 'final', at: new Date('2027-02-12T15:00:00Z') });
    const revs = slots.filter((s) => s.kind === 'revision').map((s) => s.at.toISOString());
    expect(revs[0]).toBe('2027-02-12T15:30:00.000Z');
    expect(revs.at(-1)).toBe('2027-02-12T18:30:00.000Z');
    expect(revs).toHaveLength(7);
  });
  it('runs the latest due slot once, never back-fills, nothing after doors', () => {
    expect(dueSlot(new Date('2027-02-10T18:59:00Z'), doors, slots, new Set())).toBeNull();
    const p = dueSlot(new Date('2027-02-10T19:02:00Z'), doors, slots, new Set());
    expect(p?.kind).toBe('preview');
    expect(dueSlot(new Date('2027-02-10T19:07:00Z'), doors, slots, new Set([slotKey(p!)]))).toBeNull();
    // Missed the preview entirely: at 15:01 on the day only the final runs.
    expect(dueSlot(new Date('2027-02-12T15:01:00Z'), doors, slots, new Set())?.kind).toBe('final');
    expect(dueSlot(new Date('2027-02-12T19:00:00Z'), doors, slots, new Set())).toBeNull();
  });
  it('handles the clock change: doors 7pm BST the day after clocks go forward', () => {
    // UK clocks go forward on 28 March 2027. 7pm BST on 29 March = 18:00Z. Preview 48h earlier is 27 March 18:00Z (6pm GMT).
    const d = new Date('2027-03-29T18:00:00Z');
    const s = scheduleSlots(d, sched);
    expect(s[0].at.toISOString()).toBe('2027-03-27T18:00:00.000Z');
    expect(localIso(d, 'Europe/London')).toBe('2027-03-29T19:00:00+01:00');
    expect(localIso(s[0].at, 'Europe/London')).toBe('2027-03-27T18:00:00+00:00');
  });
});

const t = (id: string, status: 'valid' | 'revoked', code = id.toUpperCase().padEnd(12, 'X')): TicketRow => ({
  ticket_id: id, barcode: code, status, ticket_type: 'General admission', unit_price_pence: 1260, order_ref: 'DS-ABC234',
  holder_first_name: 'Sam', holder_last_name: 'O"Neil', issued_at: '2027-02-01T10:00:00Z',
});

describe('report contents', () => {
  it('full report lists valid tickets and revocations of previously sent codes', () => {
    const last = new Map<string, 'valid' | 'revoked'>([['a', 'valid'], ['b', 'valid']]);
    const r = selectRows('final', [t('a', 'valid'), t('b', 'revoked'), t('c', 'valid'), t('d', 'revoked')], last);
    expect(r.rows.map((x) => `${x.ticket_id}:${x.status}`)).toEqual(['a:valid', 'c:valid', 'b:revoked']);
    expect(r).toMatchObject({ added: 1, revoked: 1, validTotal: 2 });
  });
  it('revision lists only changes', () => {
    const last = new Map<string, 'valid' | 'revoked'>([['a', 'valid'], ['b', 'valid']]);
    const r = selectRows('revision', [t('a', 'valid'), t('b', 'revoked'), t('c', 'valid')], last);
    expect(r.rows.map((x) => `${x.ticket_id}:${x.status}`)).toEqual(['c:valid', 'b:revoked']);
    expect(selectRows('revision', [t('a', 'valid')], new Map([['a', 'valid']])).rows).toHaveLength(0);
  });
  it('a sold-out event still produces a report (status is not a filter here)', () => {
    expect(selectRows('preview', [t('a', 'valid')], new Map()).rows).toHaveLength(1);
  });
  it('CSV matches the standard header exactly and quotes every value', () => {
    const { csv, sha256 } = buildCsv([t('a', 'valid', 'ABCDEFGH2345')], {
      id: 'ev1', title: 'Gig, "Live"', venue_name: 'Tramshed', doors_at: new Date('2027-02-12T19:00:00Z'), timezone: 'Europe/London',
    }, 3);
    const [head, row] = csv.trim().split('\r\n');
    expect(head).toBe('barcode,status,event_id,event_name,venue_name,doors_local,ticket_type,ticket_price,order_ref,holder_first_name,holder_last_name,issued_at,report_version');
    expect(head.split(',')).toEqual([...CLOSEOFF_HEADER]);
    expect(row).toBe('"ABCDEFGH2345","valid","ev1","Gig, ""Live""","Tramshed","2027-02-12T19:00:00+00:00","General admission","12.60","DS-ABC234","Sam","O""Neil","2027-02-01T10:00:00.000Z","3"');
    expect(sha256).toMatch(/^[0-9a-f]{64}$/);
  });
});
