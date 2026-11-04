// Partner sales statements: what Doorstep reports back to each affiliate partner.
export type LedgerRow = {
  partner_name: string; link_code: string; event_title: string; event_starts_at: string; venue_name: string;
  order_ref: string; order_status: string; paid_at: string; ticket_type_name: string; quantity: number;
  tickets_valid: number; subtotal_pence: number; fee_total_pence: number; total_pence: number;
  refunded_pence: number; net_pence: number; new_customer_via_link: boolean;
};

export const STATEMENT_HEADER = [
  'partner', 'link_code', 'event', 'event_date', 'venue', 'order_ref', 'order_status', 'paid_at', 'ticket_type',
  'tickets_bought', 'tickets_still_valid', 'ticket_value', 'booking_fees', 'gross', 'refunded', 'net', 'new_customer_via_partner',
];

const money = (p: number) => (p / 100).toFixed(2);
const q = (v: unknown) => `"${String(v ?? '').replace(/"/g, '""')}"`;

/** No customer names or emails: partners get sales, not personal data. */
export function statementCsv(rows: LedgerRow[]) {
  const lines = [STATEMENT_HEADER.join(',')];
  for (const r of rows) {
    lines.push([
      r.partner_name, r.link_code, r.event_title, r.event_starts_at.slice(0, 10), r.venue_name, r.order_ref, r.order_status,
      r.paid_at, r.ticket_type_name, r.quantity, r.tickets_valid, money(r.subtotal_pence), money(r.fee_total_pence),
      money(r.total_pence), money(r.refunded_pence), money(r.net_pence), r.new_customer_via_link ? 'yes' : 'no',
    ].map(q).join(','));
  }
  return lines.join('\r\n') + '\r\n';
}

export function statementSummary(rows: LedgerRow[]) {
  const sum = (f: (r: LedgerRow) => number) => rows.reduce((a, r) => a + f(r), 0);
  return {
    orders: rows.length,
    ticketsBought: sum((r) => r.quantity),
    ticketsStillValid: sum((r) => r.tickets_valid),
    grossPence: sum((r) => r.total_pence),
    refundedPence: sum((r) => r.refunded_pence),
    netPence: sum((r) => r.net_pence),
    newCustomers: rows.filter((r) => r.new_customer_via_link).length,
  };
}
