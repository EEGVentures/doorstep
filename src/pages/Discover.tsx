import { useQuery } from '@tanstack/react-query';
import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth, useMembership } from '@/lib/auth';
import { Empty, Loader, Notice, PrimaryLink } from '@/components/ui';
import { EventTile } from '@/components/EventTile';

export type Listing = {
  id: string; slug: string; title: string; image_url: string | null; category: string | null; starts_at: string; doors_at: string;
  status: string; venue_name: string; venue_city: string; timezone: string; from_price_pence: number | null; tickets_left: number;
};

/** A non-event bento tile: soft 3D surface for membership and how-it-works messages. */
function InfoTile({ children, tone = 'light' }: { children: React.ReactNode; tone?: 'light' | 'ink' }) {
  return (
    <div className={`tile card flex flex-col justify-between p-5 ${tone === 'ink' ? '!border-transparent surface-ink text-white' : 'tile-wash'}`}>
      {children}
    </div>
  );
}

export default function Discover() {
  const [city, setCity] = useState('all');
  const { session } = useAuth();
  const member = useMembership();
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
  const [lead, ...rest] = list;

  return (
    <div className="ambient space-y-8">
      <section className="space-y-3">
        <p className="eyebrow">What’s on near you</p>
        <h1 className="text-4xl font-bold leading-tight sm:text-5xl">Good nights out, <span className="underline decoration-coral decoration-4 underline-offset-8">on your Doorstep.</span></h1>
        <p className="max-w-xl text-muted">Gigs, comedy, theatre and more at venues near you, at member prices.</p>
      </section>
      {cities.length > 1 && (
        <div className="glass inline-flex flex-wrap gap-1 rounded-full p-1" role="group" aria-label="Filter by city">
          {['all', ...cities].map((c) => (
            <button key={c} onClick={() => setCity(c)} aria-pressed={city === c} className="chip">{c === 'all' ? 'Everywhere' : c}</button>
          ))}
        </div>
      )}
      {q.isPending && <Loader label="Finding events" />}
      {q.isError && <Notice tone="error">We couldn’t load events just now. Please refresh.</Notice>}
      {q.isSuccess && list.length === 0 && <Empty title="Nothing on sale yet">New events are added every week. Check back soon.</Empty>}
      {lead && (
        <div className="bento">
          <EventTile e={lead} size="big" />
          {rest.slice(0, 2).map((e) => <EventTile key={e.id} e={e} />)}
          {!(session && member.data) ? (
            <InfoTile tone="ink">
              <img src="/brand/doorstep-emblem-v4-white.png" alt="" className="h-9 w-9" />
              <div className="space-y-2">
                <p className="font-display text-lg font-semibold leading-snug text-white">Members book every night out</p>
                <Link to="/join" className="inline-block text-sm font-semibold text-white underline decoration-amber decoration-2 underline-offset-4">Join Doorstep →</Link>
              </div>
            </InfoTile>
          ) : rest[2] && <EventTile e={rest[2]} />}
          <InfoTile>
            <p className="eyebrow !text-ink/70">How it works</p>
            <ol className="space-y-1 text-sm font-medium text-ink">
              <li>1. Pick a night out</li><li>2. Book in a minute</li><li>3. Tickets land 48h before doors</li>
            </ol>
          </InfoTile>
          {rest.slice(session && member.data ? 3 : 2).map((e, i) => <EventTile key={e.id} e={e} size={i % 7 === 4 ? 'wide' : 'sq'} />)}
        </div>
      )}
      {session && !member.data && member.isSuccess && (
        <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">You’re not a member yet. Join to book any event.</p>
          <PrimaryLink to="/join">Become a member</PrimaryLink>
        </div>
      )}
    </div>
  );
}
