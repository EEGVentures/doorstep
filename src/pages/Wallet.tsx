import { useEffect, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Navigate, useSearchParams } from 'react-router-dom';
import QRCode from 'qrcode';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { eventDateLong, eventTime, untilText } from '@/lib/format';
import { Empty, Loader, Notice, PrimaryLink } from '@/components/ui';

type WalletTicket = {
  id: string; status: 'valid' | 'revoked'; order_ref: string; ticket_type: string; event_title: string; event_slug: string;
  image_url: string | null; starts_at: string; doors_at: string; reveal_at: string; venue_name: string; venue_city: string;
  timezone: string; holder_first_name: string | null; holder_last_name: string | null; barcode: string | null;
};

function Qr({ value }: { value: string }) {
  const [src, setSrc] = useState('');
  // Keep the machine-readable area plain: black on white with a quiet zone (architecture doc, barcode section).
  useEffect(() => { QRCode.toDataURL(value, { margin: 4, width: 512, errorCorrectionLevel: 'M', color: { dark: '#000000', light: '#FFFFFF' } }).then(setSrc); }, [value]);
  return src ? <img src={src} alt={`Ticket code ${value}`} className="mx-auto w-56 rounded-lg bg-white" /> : <div className="h-56" />;
}

export default function Wallet() {
  const { session, ready } = useAuth();
  const [params] = useSearchParams();
  const q = useQuery({
    queryKey: ['wallet'],
    enabled: Boolean(session),
    refetchInterval: params.get('paid') ? 3000 : 60_000, // right after payment, poll until the webhook has issued tickets
    queryFn: async () => {
      const { data, error } = await supabase.from('my_tickets').select('*').order('starts_at');
      if (error) throw error;
      return data as WalletTicket[];
    },
  });
  if (!ready) return <Loader />;
  if (!session) return <Navigate to="/signin?next=/wallet" replace />;

  const paidRef = params.get('order');
  const upcoming = (q.data ?? []).filter((t) => new Date(t.starts_at).getTime() > Date.now() - 6 * 3600_000);
  const waiting = params.get('paid') && paidRef && !upcoming.some((t) => t.order_ref === paidRef);

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold">Your tickets</h1>
      {waiting && <Notice>Payment received. We’re issuing your tickets for order {paidRef}; this takes a few seconds.</Notice>}
      {q.isPending && <Loader label="Loading tickets" />}
      {q.isError && <Notice tone="error">We couldn’t load your tickets. Please refresh.</Notice>}
      {q.isSuccess && upcoming.length === 0 && !waiting && <Empty title="No tickets yet"><div className="mt-4"><PrimaryLink to="/">Find a night out</PrimaryLink></div></Empty>}
      <ul className="grid gap-5 md:grid-cols-2">
        {upcoming.map((t) => {
          const revealed = Boolean(t.barcode);
          return (
            <li key={t.id} className={`card overflow-hidden ${t.status === 'revoked' ? 'opacity-60' : ''}`}>
              <div className="bg-ink p-5 text-white">
                <p className="text-xs uppercase tracking-[0.12em] text-white/70">{eventDateLong(t.starts_at, t.timezone)}</p>
                <h2 className="mt-1 font-display text-xl font-semibold text-white">{t.event_title}</h2>
                <p className="text-sm text-white/80">{t.venue_name}, {t.venue_city} · Doors {eventTime(t.doors_at, t.timezone)}</p>
              </div>
              <div className="space-y-3 p-5 text-center">
                {t.status === 'revoked' ? <Notice>This ticket was refunded or cancelled and is no longer valid.</Notice>
                  : revealed ? (<><Qr value={t.barcode!} /><p className="font-mono text-lg tracking-[0.2em]">{t.barcode}</p></>)
                  : (
                    <div className="rounded-xl bg-wash px-4 py-8">
                      <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="mx-auto mb-3 h-10 w-10" />
                      <p className="font-semibold">Your ticket lands {untilText(t.reveal_at)}</p>
                      <p className="text-sm text-muted">{eventDateLong(t.reveal_at, t.timezone)}, {eventTime(t.reveal_at, t.timezone)}. We’ll email you.</p>
                    </div>
                  )}
                <p className="text-sm text-muted">{t.ticket_type} · {[t.holder_first_name, t.holder_last_name].filter(Boolean).join(' ')} · Order {t.order_ref}</p>
              </div>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
