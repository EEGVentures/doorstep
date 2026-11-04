import { useQuery } from '@tanstack/react-query';
import { Link, useParams, useSearchParams } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth, useMembership } from '@/lib/auth';
import { eventDateLong, eventTime } from '@/lib/format';
import { Loader, Notice, PrimaryLink } from '@/components/ui';
import { TicketPicker, type TicketTypeView } from '@/components/TicketPicker';

export function useEvent(slug: string | undefined) {
  return useQuery({
    queryKey: ['event', slug],
    enabled: Boolean(slug),
    queryFn: async () => {
      const { data, error } = await supabase.from('events')
        .select('id, slug, title, description, image_url, starts_at, doors_at, status, venue:venues(name, city, address_line, postcode, timezone), ticket_types(id, name, price_pence, fee_pence, face_value_pence, capacity, sold, held, max_per_order, sort_order)')
        .eq('slug', slug!).maybeSingle();
      if (error) throw error;
      return data as any;
    },
  });
}

export function EventHeader({ ev }: { ev: any }) {
  const tz = ev.venue.timezone;
  return (
    <div className="space-y-5">
      <div className={`tile card aspect-[16/10] sm:aspect-[16/9] ${ev.image_url ? '' : 'tile-wash'}`}>
        {ev.image_url
          ? <img src={ev.image_url} alt="" className="tile-bg" />
          : <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="emblem-3d absolute left-1/2 top-[40%] w-1/5 -translate-x-1/2 -translate-y-1/2" />}
        <div className="glass absolute inset-x-3 bottom-3 rounded-[22px] p-4 sm:inset-x-4 sm:bottom-4 sm:p-5">
          <p className="eyebrow !text-ink/70">{eventDateLong(ev.starts_at, tz)}</p>
          <h1 className="text-2xl font-bold leading-tight sm:text-4xl">{ev.title}</h1>
        </div>
      </div>
      <div className="grid grid-cols-2 gap-3">
        <div className="card p-4"><p className="eyebrow">Where</p><p className="mt-1 font-medium">{ev.venue.name}</p><p className="text-sm text-muted">{[ev.venue.address_line, ev.venue.city, ev.venue.postcode].filter(Boolean).join(', ')}</p></div>
        <div className="card p-4"><p className="eyebrow">When</p><p className="mt-1 font-medium">Doors {eventTime(ev.doors_at, tz)}</p><p className="text-sm text-muted">Starts {eventTime(ev.starts_at, tz)}</p></div>
      </div>
      {ev.description && <div className="card whitespace-pre-line p-5">{ev.description}</div>}
    </div>
  );
}

export const toView = (types: any[]): TicketTypeView[] =>
  [...types].sort((a, b) => a.sort_order - b.sort_order).map((t) => ({ ...t, available: t.available ?? t.capacity - t.sold - t.held > 0 }));

export default function EventPage() {
  const { slug } = useParams();
  const [params] = useSearchParams();
  const { session } = useAuth();
  const member = useMembership();
  const q = useEvent(slug);

  if (q.isPending) return <Loader label="Loading event" />;
  if (q.isError || !q.data) return <Notice tone="error">We couldn’t find that event.</Notice>;
  const ev = q.data;
  const here = `/events/${ev.slug}`;

  return (
    <div className="ambient grid gap-8 lg:grid-cols-[1fr_380px]">
      <EventHeader ev={ev} />
      <aside className="card h-fit space-y-4 p-6 lg:sticky lg:top-24">
        {params.get('cancelled') && <Notice>Payment cancelled. Your tickets have been released.</Notice>}
        {ev.status === 'cancelled' ? <Notice>This event has been cancelled.</Notice>
          : ev.status !== 'on_sale' && ev.status !== 'sold_out' ? <Notice>Tickets are not on sale right now.</Notice>
          : !session ? (
            <>
              <h2 className="text-xl font-semibold">Book with Doorstep</h2>
              <p className="text-muted">Sign in or create an account to book.</p>
              <PrimaryLink to={`/signin?next=${encodeURIComponent(here)}`}>Sign in to book</PrimaryLink>
            </>
          ) : member.isPending ? <Loader mode="inline" label="Checking membership" />
          : member.data ? <TicketPicker types={toView(ev.ticket_types)} />
          : (
            <>
              <h2 className="text-xl font-semibold">Members book tickets</h2>
              <p className="text-muted">Join Doorstep to book this and every other event at member prices.</p>
              <PrimaryLink to={`/join?next=${encodeURIComponent(here)}`}>Become a member</PrimaryLink>
            </>
          )}
        <p className="text-xs text-muted">Questions? <Link className="link" to="/legal/refunds">Refunds and cancellations</Link></p>
      </aside>
    </div>
  );
}
