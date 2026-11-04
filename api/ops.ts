// /api/ops?action=...  Operations actions for ops and admin staff. Every write is audited.
import { z } from 'zod';
import { bodyOf, fromDbError, handler, HttpError } from '../server/http.js';
import { audit, db, requireStaff } from '../server/supabase.js';
import { stripe } from '../server/stripe.js';
import { cancelPendingOrderEmails, queueEventCancelledEmail } from '../server/orders.js';
import { statementCsv, statementSummary, type LedgerRow } from '../server/partners.js';

async function refundOrder(orderId: string, reason: string, actor: string) {
  const { data: o } = await db().from('orders').select('id, ref, status, total_pence, refunded_pence, stripe_payment_intent_id').eq('id', orderId).single();
  if (!o) throw new HttpError(404, 'NOT_FOUND', 'Order not found');
  if (!['paid', 'partially_refunded', 'exception'].includes(o.status) || !o.stripe_payment_intent_id) {
    throw new HttpError(409, 'NOT_REFUNDABLE', `Order ${o.ref} cannot be refunded (status ${o.status}).`);
  }
  const amount = o.total_pence - o.refunded_pence; // full refund including booking fee (drafted policy, to confirm)
  const refund = await stripe().refunds.create(
    { payment_intent: o.stripe_payment_intent_id, amount, metadata: { order_id: o.id, reason } },
    { idempotencyKey: `refund-${o.id}-${o.refunded_pence}` },
  );
  if (o.status === 'exception') {
    await db().from('orders').update({ status: 'paid' }).eq('id', o.id); // lets record_refund close it out
  }
  const { data: updated, error } = await db().rpc('record_refund', {
    p_order: o.id, p_amount_pence: amount, p_reason: reason, p_stripe_refund_id: refund.id, p_actor: actor,
  });
  if (error) throw fromDbError(error);
  await cancelPendingOrderEmails(o.id);
  return { order: updated, amount };
}

export default handler(['GET', 'POST'], async (req, res) => {
  const action = String(req.query.action ?? '');
  const staff = await requireStaff(req);
  const adminOnly = () => { if (staff.role !== 'admin') throw new HttpError(403, 'FORBIDDEN', 'Admins only.'); };

  if (req.method === 'GET' && action === 'dashboard') {
    const [links, exceptions, closeoffs] = await Promise.all([
      db().from('affiliate_link_stats').select('*'),
      db().from('orders').select('id, ref, exception_reason, total_pence, created_at').eq('status', 'exception'),
      db().from('closeoff_reports').select('id, event_id, version, kind, delivery_status, delivered_at, acknowledged_at, valid_total, event:events(title, doors_at)')
        .is('acknowledged_at', null).in('kind', ['final', 'revision']).order('generated_at', { ascending: false }).limit(50),
    ]);
    return { affiliateLinks: links.data, orderExceptions: exceptions.data, closeoffsAwaitingAck: closeoffs.data };
  }

  if (req.method === 'GET' && action === 'partner-statement') {
    const p = z.object({ partnerId: z.string().uuid(), from: z.string().date(), to: z.string().date(), format: z.enum(['csv', 'json']).default('csv') }).parse(req.query);
    const { data, error } = await db().from('partner_sales_ledger').select('*').eq('partner_id', p.partnerId)
      .gte('paid_at', `${p.from}T00:00:00Z`).lt('paid_at', `${p.to}T23:59:59.999Z`).order('paid_at');
    if (error) throw error;
    const rows = (data ?? []) as LedgerRow[];
    await audit(staff.id, 'partner.statement', 'partner', p.partnerId, { from: p.from, to: p.to, rows: rows.length });
    if (p.format === 'json') return { summary: statementSummary(rows), rows };
    res.setHeader('content-type', 'text/csv; charset=utf-8');
    res.setHeader('content-disposition', `attachment; filename="doorstep-partner-statement-${p.from}-to-${p.to}.csv"`);
    res.status(200).send(statementCsv(rows));
    return;
  }

  if (req.method !== 'POST') throw new HttpError(404, 'UNKNOWN_ACTION', 'Unknown action');

  switch (action) {
    case 'refund': {
      const b = bodyOf(req, z.object({ orderId: z.string().uuid(), reason: z.string().min(3).max(200) }).parse);
      return refundOrder(b.orderId, b.reason, staff.id);
    }
    case 'cancel-event': {
      adminOnly();
      const b = bodyOf(req, z.object({ eventId: z.string().uuid(), reason: z.string().min(3).max(200), confirmTitle: z.string() }).parse);
      const { data: ev } = await db().from('events').select('id, title, status').eq('id', b.eventId).single();
      if (!ev) throw new HttpError(404, 'NOT_FOUND', 'Event not found');
      if (b.confirmTitle !== ev.title) throw new HttpError(400, 'CONFIRM', 'Type the event title exactly to confirm.');
      await db().from('events').update({ status: 'cancelled' }).eq('id', ev.id);
      await audit(staff.id, 'event.cancel', 'event', ev.id, { reason: b.reason });
      const { data: orders } = await db().from('orders').select('id').eq('event_id', ev.id).in('status', ['paid', 'partially_refunded']);
      const results = [];
      for (const o of orders ?? []) {
        try {
          const r = await refundOrder(o.id, `Event cancelled: ${b.reason}`, staff.id);
          await queueEventCancelledEmail(o.id, r.amount);
          results.push({ orderId: o.id, refunded: r.amount });
        } catch (e) {
          results.push({ orderId: o.id, error: (e as Error).message });
        }
      }
      return { cancelled: ev.id, refunds: results };
    }
    case 'create-partner': {
      const b = bodyOf(req, z.object({ name: z.string().min(2).max(120), contactEmail: z.string().email().optional() }).parse);
      const { data, error } = await db().from('partners').insert({ name: b.name, contact_email: b.contactEmail ?? null }).select().single();
      if (error) throw error;
      await audit(staff.id, 'partner.create', 'partner', data.id, b);
      return data;
    }
    case 'approve-partner': {
      adminOnly(); // every affiliate partner is approved by an admin (docs/08)
      const b = bodyOf(req, z.object({ partnerId: z.string().uuid(), status: z.enum(['approved', 'suspended']).default('approved') }).parse);
      const { data, error } = await db().from('partners')
        .update({ status: b.status, approved_by: staff.id, approved_at: new Date().toISOString() }).eq('id', b.partnerId).select().single();
      if (error) throw error;
      await audit(staff.id, `partner.${b.status}`, 'partner', b.partnerId);
      return data;
    }
    case 'create-link': {
      const b = bodyOf(req, z.object({
        partnerId: z.string().uuid(), eventId: z.string().uuid(),
        code: z.string().trim().toUpperCase().regex(/^[A-Z0-9-]{4,40}$/).optional(),
        maxPerOrder: z.number().int().min(1).max(20).default(6),
        expiresAt: z.string().datetime().optional(),
      }).parse);
      const { data: partner } = await db().from('partners').select('name, status').eq('id', b.partnerId).single();
      if (partner?.status !== 'approved') throw new HttpError(409, 'PARTNER_NOT_APPROVED', 'An admin must approve this partner first.');
      const code = b.code ?? `${partner.name.replace(/[^A-Za-z0-9]/g, '').slice(0, 10).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
      const { data, error } = await db().from('affiliate_links').insert({
        partner_id: b.partnerId, event_id: b.eventId, code, max_per_order: b.maxPerOrder, expires_at: b.expiresAt ?? null, created_by: staff.id,
      }).select().single();
      if (error) throw error;
      await audit(staff.id, 'affiliate_link.create', 'affiliate_link', data.id, { code });
      return { ...data, url: `${process.env.SITE_URL ?? ''}/go/${code}` };
    }
    case 'ack-closeoff': {
      const b = bodyOf(req, z.object({ reportId: z.string().uuid(), note: z.string().min(3).max(500) }).parse);
      const { data, error } = await db().from('closeoff_reports')
        .update({ acknowledged_at: new Date().toISOString(), acknowledged_by: staff.id, acknowledgement_note: b.note })
        .eq('id', b.reportId).is('acknowledged_at', null).select('id, version, acknowledged_at').maybeSingle();
      if (error) throw error;
      if (!data) throw new HttpError(409, 'ALREADY_ACKED', 'This report is already acknowledged.');
      await audit(staff.id, 'closeoff.ack', 'closeoff_report', b.reportId, { note: b.note });
      return data;
    }
    default:
      throw new HttpError(404, 'UNKNOWN_ACTION', 'Unknown action');
  }
});
