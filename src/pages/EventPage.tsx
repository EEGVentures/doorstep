import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useCallback, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { eventDateLong, eventTime, pounds2 } from '@/lib/format';
import { photoName } from '@/components/EventTile';
import { BottomSheet } from '@/components/BottomSheet';
import { Loader, Notice, PrimaryLink } from '@/components/ui';
import { TicketPicker, type TicketTypeView } from '@/components/TicketPicker';
import { FlagBanner } from '@/components/FlagBanner';

/**
 * Seeds the event page from the listing the customer just tapped, so the hero (and the shared photo transition)
 * renders on the first frame instead of a skeleton. Tickets and full venue details arrive with the real query.
 */
function fromListing(qc: ReturnType<typeof useQueryClient>, slug?: string) {
  const l = (qc.getQueryData(['listings']) as any[] | undefined)?.find((x) => x.slug === slug);
  if (!l) return undefined;
  return { id: l.id, slug: l.slug, title: l.title, description: null, category: l.category, flag: l.flag, image_url: l.image_url, starts_at: l.starts_at, doors_at: l.doors_at, status: l.status,
    venue: { name: l.venue_name, city: l.venue_city, address_line: l.venue_address ?? null, postcode: l.venue_postcode ?? null, timezone: l.timezone, lat: l.venue_lat, lng: l.venue_lng },
    ticket_types: [], placeholder: true };
}

// Guests may not read prices (column grants in the database), so ask for them only when signed in.
const TT_BASE = 'id, name, capacity, sold, held, max_per_order, sort_order';
const TT_PRICED = `${TT_BASE}, price_pence, fee_pence, face_value_pence`;

export function useEvent(slug: string | undefined) {
  const qc = useQueryClient();
  const { session } = useAuth();
  const signedIn = Boolean(session);
  return useQuery({
    queryKey: ['event', slug, signedIn],
    enabled: Boolean(slug),
    placeholderData: () => fromListing(qc, slug),
    queryFn: async () => {
      // The flag (New / Selling fast / Last few) is worked out in the database, on the listing view.
      const [{ data, error }, flag] = await Promise.all([
        supabase.from('events')
          .select(`id, slug, title, description, category, image_url, starts_at, doors_at, status, venue:venues(name, city, address_line, postcode, timezone, lat, lng), ticket_types(${signedIn ? TT_PRICED : TT_BASE})`)
          .eq('slug', slug!).maybeSingle(),
        supabase.from('event_listings').select('flag').eq('slug', slug!).maybeSingle(),
      ]);
      if (error) throw error;
      return data ? { ...data, flag: (flag.data as any)?.flag ?? null } as any : null;
    },
  });
}

export function EventHeader({ ev }: { ev: any }) {
  const tz = ev.venue.timezone;
  return (
    <div className="space-y-4">
      <div className={`tile tile-hero aspect-[4/5] sm:aspect-[16/9] ${ev.image_url ? "!bg-transparent" : "tile-wash"}`}>
        {ev.image_url && <img src={ev.image_url} alt="" className="tile-bg" style={{ viewTransitionName: photoName(ev.slug) }} />}
        {ev.status !== 'sold_out' && ev.flag && <div className="absolute left-5 top-5 sm:left-8 sm:top-8"><FlagBanner flag={ev.flag} onDark={Boolean(ev.image_url)} size="md" /></div>}
        {/* Caption carries its own fade and transition name, so it settles over the photo as the photo grows into place. */}
        <div className={`absolute inset-x-0 bottom-0 rounded-b-[28px] p-5 sm:p-8 ${ev.image_url ? 'hero-caption pt-24 text-white sm:pt-32' : 'text-ink'}`}>
          <p className={`text-sm font-medium tabular-nums sm:text-base ${ev.image_url ? 'text-white/80' : 'text-ink/70'}`}>{ev.category ? <>{ev.category} · </> : null}{eventDateLong(ev.starts_at, tz)}</p>
          <h1 className={`mt-1 text-3xl font-bold leading-[1.08] sm:text-5xl ${ev.image_url ? '!text-white' : ''}`}>{ev.title}</h1>
          <p className={`mt-1 ${ev.image_url ? 'text-white/80' : 'text-ink/70'}`}>{ev.venue.name}, {ev.venue.city}</p>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4 sm:p-5"><p className="eyebrow">Where</p><p className="mt-0.5 font-medium">{ev.venue.name}</p><p className="text-sm text-muted">{[ev.venue.address_line, ev.venue.city, ev.venue.postcode].filter(Boolean).join(', ')}</p></div>
        <div className="card p-4 sm:p-5"><p className="eyebrow">When</p><p className="mt-0.5 font-medium tabular-nums">Doors {eventTime(ev.doors_at, tz)}</p><p className="text-sm tabular-nums text-muted">Starts {eventTime(ev.starts_at, tz)}</p></div>
      </div>
      {ev.description && <div className="card whitespace-pre-line p-5 sm:p-6">{ev.description}</div>}
    </div>
  );
}

/** Sticky glass bar on phones: price on the left, opens the booking sheet. */
export function BuyBar({ from, label, onOpen, disabled, tucked }: { from: number | null; label: string; onOpen: () => void; disabled?: boolean; tucked?: boolean }) {
  return (
    <div className="buybar fixed inset-x-0 bottom-0 z-30 px-3 pb-[max(12px,env(safe-area-inset-bottom))] lg:hidden" data-tucked={tucked || undefined} aria-hidden={tucked || undefined}>
      <div className="glass mx-auto flex max-w-xl items-center justify-between gap-3 rounded-full py-2 pl-5 pr-2">
        <div className="leading-tight">
          {from != null ? <><p className="text-xs text-muted">From</p><p className="font-semibold tabular-nums">{pounds2(from)}</p></> : <p className="text-sm font-medium">Tickets</p>}
        </div>
        <button className="btn-primary" onClick={onOpen} disabled={disabled}><span className="!px-5 !py-2.5">{label}<span className="arrow" aria-hidden="true">→</span></span></button>
      </div>
    </div>
  );
}

export const toView = (types: any[]): TicketTypeView[] =>
  [...types].sort((a, b) => a.sort_order - b.sort_order).map((t) => ({ ...t, available: t.available ?? t.capacity - t.sold - t.held > 0 }));

/** Guest view: what's on sale, with prices only if the database shares them with guests. */
function GuestTickets({ types, here }: { types: TicketTypeView[]; here: string }) {
  const priced = types.some((t) => t.price_pence != null);
  return (
    <>
      <h2 className="text-xl font-semibold">Fancy it?</h2>
      {types.length > 0 && (
        <ul className="divide-y divide-line rounded-2xl border border-line">
          {types.map((t) => (
            <li key={t.id} className="flex items-center justify-between gap-3 px-4 py-3">
              <span className={`font-medium ${t.available ? '' : 'text-muted line-through'}`}>{t.name}</span>
              <span className="text-sm tabular-nums text-muted">{!t.available ? 'Sold out' : priced ? pounds2(t.price_pence + t.fee_pence) : 'Sign in for price'}</span>
            </li>
          ))}
        </ul>
      )}
      <p className="text-muted">{priced ? 'Booking needs a free Doorstep account. It takes a minute.' : 'Prices are shown once you sign in. Your account is free and takes a minute.'}</p>
      <PrimaryLink to={`/signin?next=${encodeURIComponent(here)}`}>{priced ? 'Sign in to book' : 'Sign in to see prices'}</PrimaryLink>
    </>
  );
}

function BookingPanel({ ev, here }: { ev: any; here: string }) {
  const [params] = useSearchParams();
  const { session } = useAuth();
  return (
    <div className="space-y-4">
      {params.get('cancelled') && <Notice>Payment cancelled. Your tickets have been released.</Notice>}
      {ev.status === 'cancelled' ? <Notice>This event has been cancelled.</Notice>
        : ev.status !== 'on_sale' && ev.status !== 'sold_out' ? <Notice>Tickets are not on sale right now.</Notice>
        : !session ? <GuestTickets types={toView(ev.ticket_types)} here={here} />
        : <TicketPicker types={toView(ev.ticket_types)} />}
      <p className="text-xs text-muted">Questions? <Link className="link" to="/legal/refunds">Refunds and cancellations</Link></p>
    </div>
  );
}

export const fromPrice = (types: any[]) => {
  const p = types.filter((t) => t.price_pence != null && (t.capacity - t.sold - t.held > 0 || t.available)).map((t) => t.price_pence + t.fee_pence);
  return p.length ? Math.min(...p) : null;
};

export default function EventPage() {
  const { slug } = useParams();
  const [sheet, setSheet] = useState(false);
  const close = useCallback(() => setSheet(false), []);
  const q = useEvent(slug);

  if (q.isPending) return <div className="space-y-4" aria-label="Loading event" role="status"><div className="skeleton aspect-[4/5] !rounded-[28px] sm:aspect-[16/9]" /><div className="grid grid-cols-2 gap-3"><div className="skeleton h-24" /><div className="skeleton h-24" /></div></div>;
  if (q.isError) return <div className="card flex items-center justify-between gap-3 p-6"><p className="font-medium">We couldn’t load this event.</p><button className="btn-secondary !py-2" onClick={() => q.refetch()}>Try again</button></div>;
  if (!q.data) return <Notice tone="error">We couldn’t find that event.</Notice>;
  const ev = q.data;
  const here = `/events/${ev.slug}`;
  const from = fromPrice(ev.ticket_types ?? []);
  const types = ev.ticket_types ?? [];
  const soldOut = ev.status === 'sold_out' || (!q.isPlaceholderData && !types.some((t: any) => t.capacity - t.sold - t.held > 0));

  return (
    <div className="ambient grid gap-8 pb-24 lg:grid-cols-[1fr_380px] lg:pb-0">
      <EventHeader ev={ev} />
      <aside className="card hidden h-fit p-6 lg:sticky lg:top-24 lg:block">{q.isPlaceholderData ? <Loader mode="inline" label="Getting tickets" /> : <BookingPanel ev={ev} here={here} />}</aside>
      <BuyBar from={soldOut ? null : from} label={soldOut ? 'Sold out' : from == null ? 'See tickets' : 'Get tickets'} onOpen={() => setSheet(true)} disabled={soldOut && ev.status !== 'on_sale'} tucked={sheet || q.isPlaceholderData} />
      <BottomSheet open={sheet} onClose={close} label="Book tickets">
        <h2 className="mb-1 text-lg font-semibold">{ev.title}</h2>
        <p className="mb-4 text-sm tabular-nums text-muted">{eventDateLong(ev.starts_at, ev.venue.timezone)}</p>
        <BookingPanel ev={ev} here={here} />
      </BottomSheet>
    </div>
  );
}
