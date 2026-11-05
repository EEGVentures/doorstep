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

/** Live countdown to doors. Ticks every second inside the last day, every minute before that. */
function useNow(fine: boolean) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => { const t = setInterval(() => setNow(Date.now()), fine ? 1000 : 30_000); return () => clearInterval(t); }, [fine]);
  return now;
}
function countdown(ms: number) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000), d = Math.floor(s / 86400), h = Math.floor((s % 86400) / 3600), m = Math.floor((s % 3600) / 60), sec = s % 60;
  const p = (n: number) => String(n).padStart(2, '0');
  return d > 0 ? [`${d}d`, `${p(h)}h`, `${p(m)}m`] : [`${p(h)}h`, `${p(m)}m`, `${p(sec)}s`];
}

/**
 * Door pass: the ticket is a door. Gable top like the emblem, ink panel, a countdown to doors,
 * the code in the letterbox panel once it's released (48h before doors), and the gradient doorstep line underneath.
 */
/** Nathan's copy rule (5 Nov 2026): wherever "door pass" appears, follow it with this line. */
export const PASS_LINE = 'Your digital ticket, in the Doorstep app and Apple Wallet.';

function DoorPass({ t }: { t: WalletTicket }) {
  const doors = new Date(t.doors_at).getTime();
  const now = useNow(doors - Date.now() < 86400e3);
  const left = countdown(doors - now);
  const revealed = Boolean(t.barcode);
  const revoked = t.status === 'revoked';
  return (
    <li className={`door-pass-wrap ${revoked ? 'opacity-60' : ''}`}>
      <article className="door-pass text-white">
        {t.image_url && <img src={t.image_url} alt="" className="door-pass-photo" />}
        <div className="relative flex items-center justify-between px-6 pt-14 text-xs text-white/70">
          <span className="inline-flex min-w-0 items-center gap-2"><img src="/brand/doorstep-emblem-v4-white.png" alt="" className="h-5 w-5 shrink-0" />
            <span className="min-w-0"><span className="block font-medium text-white/85">Door pass</span><span className="block text-[11px] leading-snug text-white/60">{PASS_LINE}</span></span></span>
          <span className="shrink-0 self-start tabular-nums">{t.order_ref}</span>
        </div>
        <div className="relative space-y-1 px-6 pt-6">
          <p className="text-sm tabular-nums text-white/75">{eventDateLong(t.starts_at, t.timezone)}</p>
          <h2 className="font-display text-2xl font-semibold leading-tight text-white sm:text-3xl" style={{ textWrap: 'balance' }}>{t.event_title}</h2>
          <p className="text-white/80">{t.venue_name}, {t.venue_city}</p>
        </div>
        <div className="relative px-6 pt-6">
          {left ? (
            <>
              <p className="text-sm text-white/70">Doors open in</p>
              <p className="font-display text-4xl font-semibold tabular-nums tracking-tight text-white" aria-live="off">
                {left.map((x, k) => <span key={k} className={k ? 'ml-3' : ''}>{x}</span>)}
              </p>
            </>
          ) : <p className="font-display text-2xl font-semibold text-white">Doors are open. Have a good night.</p>}
          <p className="mt-1 text-sm tabular-nums text-white/70">Doors {eventTime(t.doors_at, t.timezone)} · Starts {eventTime(t.starts_at, t.timezone)}</p>
        </div>
        <div className="relative p-3 pt-6">
          <div className="letterbox rounded-[22px] bg-white p-5 text-center text-ink">
            {revoked ? <p className="font-medium">This pass was refunded or cancelled and no longer opens the door.</p>
              : revealed ? (<><Qr value={t.barcode!} /><p className="mt-2 font-mono text-lg tracking-[0.2em]">{t.barcode}</p><p className="text-xs text-muted">Show this at the door. Brightness up helps.</p></>)
              : (
                <div className="py-4">
                  <p className="font-semibold">Your code appears here {untilText(t.reveal_at)}</p>
                  <p className="text-sm tabular-nums text-muted">{eventDateLong(t.reveal_at, t.timezone)}, {eventTime(t.reveal_at, t.timezone)}. We’ll email you when it lands.</p>
                </div>
              )}
            <p className="mt-3 border-t border-line pt-3 text-xs text-muted">{t.ticket_type} · {[t.holder_first_name, t.holder_last_name].filter(Boolean).join(' ')}</p>
          </div>
        </div>
      </article>
      <span className="doorstep-line" aria-hidden="true" />
    </li>
  );
}

/** What a door pass is, in three steps. Collapsible once you've read it (remembered on this device). */
function PassExplainer() {
  const [open, setOpen] = useState(() => { try { return localStorage.getItem('ds_pass_help') !== 'closed'; } catch { return true; } });
  const toggle = () => { setOpen((o) => { try { localStorage.setItem('ds_pass_help', o ? 'closed' : 'open'); } catch { /* fine */ } return !o; }); };
  const steps = [
    ['Booked', 'Your pass appears here straight away, counting down to doors.'],
    ['Your code lands 48 hours before doors', 'We email you when it does. Holding it back until then stops passes being copied or resold.'],
    ['Show it at the door', 'Staff scan the code on your phone. Turn your brightness up and you’re in.'],
  ];
  return (
    <section className="card p-5 sm:p-6" aria-labelledby="pass-help">
      <div className="flex items-center justify-between gap-3">
        <h2 id="pass-help" className="text-lg font-semibold">How door passes work</h2>
        <button className="press text-sm font-medium text-muted underline underline-offset-4" onClick={toggle} aria-expanded={open}>{open ? 'Hide' : 'Show'}</button>
      </div>
      {open && (
        <ol className="mt-4 grid gap-4 sm:grid-cols-3">
          {steps.map(([title, body], k) => (
            <li key={title} className="flex gap-3">
              <span className="num-dot" aria-hidden="true">{k + 1}</span>
              <span><span className="block font-medium text-ink">{title}</span><span className="block text-sm text-muted">{body}</span></span>
            </li>
          ))}
        </ol>
      )}
    </section>
  );
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
    <div className="ambient space-y-6">
      <div>
        <h1 className="text-3xl font-bold sm:text-4xl">Your door passes</h1>
        <p className="text-muted">{PASS_LINE}</p>
      </div>
      <PassExplainer />
      {waiting && <Notice>Payment received. We’re issuing your passes for order {paidRef}; this takes a few seconds.</Notice>}
      {q.isPending && <Loader label="Loading your passes" />}
      {q.isError && <div className="card flex items-center justify-between gap-3 p-6"><p className="font-medium">We couldn’t load your passes.</p><button className="btn-secondary !py-2" onClick={() => q.refetch()}>Try again</button></div>}
      {q.isSuccess && upcoming.length === 0 && !waiting && <Empty title="No nights booked yet"><div className="mt-4"><PrimaryLink to="/">Find a night out</PrimaryLink></div></Empty>}
      <ul className="grid gap-8 md:grid-cols-2 lg:max-w-4xl">
        {upcoming.map((t) => <DoorPass key={t.id} t={t} />)}
      </ul>
    </div>
  );
}
