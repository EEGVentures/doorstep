import { describe, expect, it } from 'vitest';
import { statementCsv, statementSummary, type LedgerRow } from '../../server/partners.js';

const row = (o: Partial<LedgerRow>): LedgerRow => ({
  partner_name: 'Blue Light Card', link_code: 'BLC-TRAM', event_title: 'Gig', event_starts_at: '2027-02-12T20:00:00Z', venue_name: 'Tramshed',
  order_ref: 'DS-AAAAAA', order_status: 'paid', paid_at: '2027-02-01T10:00:00Z', ticket_type_name: 'GA', quantity: 2, tickets_valid: 2,
  subtotal_pence: 2520, fee_total_pence: 300, total_pence: 2820, refunded_pence: 0, net_pence: 2820, new_customer_via_link: true, ...o,
});

describe('partner statements', () => {
  it('nets refunds and counts new customers', () => {
    const rows = [row({}), row({ order_ref: 'DS-BBBBBB', order_status: 'refunded', tickets_valid: 0, refunded_pence: 2820, net_pence: 0, new_customer_via_link: false })];
    expect(statementSummary(rows)).toEqual({ orders: 2, ticketsBought: 4, ticketsStillValid: 2, grossPence: 5640, refundedPence: 2820, netPence: 2820, newCustomers: 1 });
    const csv = statementCsv(rows);
    expect(csv.split('\r\n')[1]).toContain('"28.20","0.00","28.20","yes"');
    expect(csv).not.toMatch(/@/); // no customer emails
  });
});
