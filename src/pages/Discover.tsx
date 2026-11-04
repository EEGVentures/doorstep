import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { useMemo, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { eventDate, eventTime, pounds } from '@/lib/format';
import { Empty, Loader, Notice } from '@/components/ui';

export type Listing = {
  id: string; slug: string; title: string; image_url: string | null; category: string | null; starts_at: string; doors_at: string;
  status: string; venue_name: string; venue_city: string; timezone: string; from_price_pence: number | null; tickets_left: number;
};

export default function Discover() {
  const [city, setCity] = useState('all');
  const q = useQuery({
    queryKey: ['listings'],
    queryFn: async () => {
      const { data, error } = await supabase.from('event_listings').select('*')
        .in('status', ['on_sale', 'sold_out']).gt('starts_at', new Date().toISOString()).order('starts_at').limit(100);
      if (error) throw error;
      return data as Listing[];
    },
  });
  const cities = useMemo(() => [...new Set((q.data ?? []).map((e) => e.venue_city))].sort(), [q.data]);
  const list = (q.data ?? []).filter((e) => city === 'all' || e.venue_city === city);

  return (
    <div className="space-y-8">
      <section className="space-y-3">
        <p className="eyebrow">What’s on near you</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Good nights out, <span className="underline decoration-coral decoration-4 underline-offset-8">on your Doorstep.</span></h1>
        <p className="max-w-xl text-muted">Gigs, comedy, theatre and more at venues near you, at member prices.</p>
      </section>
      {cities.length > 1 && (
        <div className="flex flex-wrap gap-2" role="group" aria-label="Filter by city">
          {['all', ...cities].map((c) => (
            <button key={c} onClick={() => setCity(c)} aria-pressed={city === c}
              className={`rounded-full border px-4 py-2 text-sm ${city === c ? 'border-ink bg-ink text-white' : 'border-line bg-white text-ink'}`}>{c === 'all' ? 'Everywhere' : c}</button>
          ))}
        </div>
      )}
      {q.isPending && <Loader label="Finding events" />}
      {q.isError && <Notice tone="error">We couldn’t load events just now. Please refresh.</Notice>}
      {q.isSuccess && list.length === 0 && <Empty title="Nothing on sale yet">New events are added every week. Check back soon.</Empty>}
      <ul className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {list.map((e) => (
          <li key={e.id}>
            <Link to={`/events/${e.slug}`} className="card group block overflow-hidden">
              <div className="aspect-[16/10] bg-wash">
                {e.image_url ? <img src={e.image_url} alt="" className="h-full w-full object-cover" loading="lazy" /> : <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="mx-auto h-full w-1/4 object-contain opacity-60" />}
              </div>
              <div className="space-y-1 p-4">
                <p className="eyebrow">{eventDate(e.starts_at, e.timezone)} · {eventTime(e.starts_at, e.timezone)}</p>
                <h2 className="text-lg font-semibold leading-snug group-hover:underline">{e.title}</h2>
                <p className="text-sm text-muted">{e.venue_name}, {e.venue_city}</p>
                <p className="pt-1 text-sm font-semibold">{e.status === 'sold_out' || e.tickets_left === 0 ? 'Sold out' : `From ${pounds(e.from_price_pence)}`}</p>
              </div>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}
