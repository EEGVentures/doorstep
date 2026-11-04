// Operations dashboard (ops and admin only; the server checks the role on every call).
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useProfile } from '@/lib/auth';
import { pounds2 } from '@/lib/format';
import { Loader, Notice } from '@/components/ui';

type Dash = {
  affiliateLinks: { link_id: string; code: string; partner_id: string; partner_name: string; event_title: string; visits: number; unique_visitors: number; signups: number; paid_orders: number; tickets_sold: number; net_revenue_pence: number; marketing_optins: number; converted_to_members: number }[];
  orderExceptions: { id: string; ref: string; exception_reason: string; total_pence: number }[];
  closeoffsAwaitingAck: { id: string; version: number; kind: string; delivery_status: string; valid_total: number; event: { title: string; doors_at: string } }[];
};

export default function Ops() {
  const profile = useProfile();
  const q = useQuery({ queryKey: ['ops'], enabled: ['ops', 'admin'].includes(profile.data?.role ?? ''), queryFn: () => api<Dash>('ops?action=dashboard') });
  const today = new Date().toISOString().slice(0, 10);
  const monthStart = today.slice(0, 8) + '01';
  const [from, setFrom] = useState(monthStart);
  const [to, setTo] = useState(today);

  if (profile.isPending) return <Loader />;
  if (!['ops', 'admin'].includes(profile.data?.role ?? '')) return <Navigate to="/" replace />;

  async function statement(partnerId: string, name: string) {
    const { data } = await supabase.auth.getSession();
    const res = await fetch(`/api/ops?action=partner-statement&partnerId=${partnerId}&from=${from}&to=${to}`, { headers: { authorization: `Bearer ${data.session?.access_token}` } });
    const blob = await res.blob();
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(blob), download: `${name}-statement-${from}-to-${to}.csv` });
    a.click();
  }
  async function ack(id: string) {
    const note = prompt('How did the venue confirm the import? (e.g. "Email from box office, 2:10pm")');
    if (note) { await api(`ops?action=ack-closeoff`, { body: { reportId: id, note } }); q.refetch(); }
  }

  const partners = [...new Map((q.data?.affiliateLinks ?? []).map((l) => [l.partner_id, l.partner_name])).entries()];
  return (
    <div className="space-y-8">
      <h1 className="text-3xl font-bold">Operations</h1>
      {q.isPending && <Loader />}
      {q.data && (<>
        {q.data.orderExceptions.length > 0 && (
          <Notice tone="error"><strong>Orders needing attention:</strong> {q.data.orderExceptions.map((o) => `${o.ref} (${o.exception_reason})`).join('; ')}</Notice>
        )}
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Partner links</h2>
          <div className="overflow-x-auto card">
            <table className="w-full text-sm">
              <thead className="text-left text-muted"><tr>{['Partner', 'Event', 'Code', 'Visits', 'Unique', 'Sign-ups', 'Opted in', 'Orders', 'Tickets', 'Net sales', 'Became members'].map((h) => <th key={h} className="px-3 py-2 font-medium">{h}</th>)}</tr></thead>
              <tbody>{q.data.affiliateLinks.map((l) => (
                <tr key={l.link_id} className="border-t border-line">
                  <td className="px-3 py-2">{l.partner_name}</td><td className="px-3 py-2">{l.event_title}</td><td className="px-3 py-2 font-mono">{l.code}</td>
                  <td className="px-3 py-2">{l.visits}</td><td className="px-3 py-2">{l.unique_visitors}</td><td className="px-3 py-2">{l.signups}</td>
                  <td className="px-3 py-2">{l.marketing_optins}</td><td className="px-3 py-2">{l.paid_orders}</td><td className="px-3 py-2">{l.tickets_sold}</td>
                  <td className="px-3 py-2">{pounds2(l.net_revenue_pence)}</td><td className="px-3 py-2">{l.converted_to_members}</td>
                </tr>))}</tbody>
            </table>
          </div>
          <div className="card flex flex-wrap items-end gap-3 p-4">
            <div><label className="label" htmlFor="from">From</label><input id="from" type="date" className="field" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
            <div><label className="label" htmlFor="to">To</label><input id="to" type="date" className="field" value={to} onChange={(e) => setTo(e.target.value)} /></div>
            {partners.map(([id, name]) => <button key={id} className="btn-secondary" onClick={() => statement(id, name)}>Statement: {name}</button>)}
          </div>
        </section>
        <section className="space-y-3">
          <h2 className="text-xl font-semibold">Close-offs waiting for venue confirmation</h2>
          {q.data.closeoffsAwaitingAck.length === 0 ? <p className="text-muted">None.</p> : (
            <ul className="space-y-2">{q.data.closeoffsAwaitingAck.map((r) => (
              <li key={r.id} className="card flex items-center justify-between p-4">
                <span>{r.event.title} · {r.kind} v{r.version} · {r.valid_total} tickets · {r.delivery_status === 'held_test_mode' ? 'test inbox only' : r.delivery_status}</span>
                <button className="btn-secondary" onClick={() => ack(r.id)}>Record confirmation</button>
              </li>))}</ul>
          )}
        </section>
      </>)}
    </div>
  );
}
