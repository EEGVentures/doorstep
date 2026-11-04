import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth, useMembership } from '@/lib/auth';
import { Empty, Loader, PrimaryLink } from '@/components/ui';
import { EventTile, TileSkeleton, type TileSize } from '@/components/EventTile';

export type Listing = {
  id: string; slug: string; title: string; image_url: string | null; category: string | null; starts_at: string; doors_at: string;
  status: string; venue_name: string; venue_city: string; timezone: string; from_price_pence: number | null; tickets_left: number;
};

/** True once `on` has stayed true for `ms`. The waving loader only appears for waits over a second. */
function useAfter(on: boolean, ms: number) {
  const [late, setLate] = useState(false);
  useEffect(() => {
    if (!on) { setLate(false); return; }
    const t = setTimeout(() => setLate(true), ms);
    return () => clearTimeout(t);
  }, [on, ms]);
  return late;
}

/**
 * Bento rhythm after the lead block: rows of four grid units built from one wide tile and two small ones,
 * alternating sides, with at most three wide tiles; then rows of small tiles. Rows never leave a gap on desktop.
 */
export function bentoSizes(n: number, maxWide = 3): TileSize[] {
  const out: TileSize[] = [];
  let wide = 0, row = 0;
  while (out.length < n) {
    const left = n - out.length;
    if (left >= 3 && (wide < maxWide || left === 3)) { const r: TileSize[] = ['wide', 'sm', 'sm']; out.push(...(row % 2 ? r.reverse() : r)); wide++; }
    else if (left === 2) out.push('wide', 'wide');
    else if (left === 1) out.push('wide');
    else out.push('sm', 'sm', 'sm', 'sm');
    row++;
  }
  return out.slice(0, n);
}

/**
 * Glass segmented filter. A white-on-ink copy of the list sits on top, clipped to the selected city, and the clip
 * moves between cities. The text changes colour exactly where the pill is, which colour transitions on each chip can't do.
 */
function CityFilter({ options, value, onChange }: { options: string[]; value: string; onChange: (c: string) => void }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState<string | null>(null);
  useLayoutEffect(() => {
    const measure = () => {
      const box = wrap.current;
      const el = box?.querySelector<HTMLButtonElement>(`[data-city="${CSS.escape(value)}"]`);
      if (!box || !el) return;
      const right = box.clientWidth - el.offsetLeft - el.offsetWidth;
      const bottom = box.clientHeight - el.offsetTop - el.offsetHeight;
      setClip(`inset(${el.offsetTop}px ${right}px ${bottom}px ${el.offsetLeft}px round 999px)`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, options.join('|')]);
  const label = (c: string) => (c === 'all' ? 'Everywhere' : c);
  return (
    <div ref={wrap} className="glass relative inline-flex max-w-full flex-wrap gap-1 rounded-full p-1" role="group" aria-label="Filter by city">
      {options.map((c) => (
        <button key={c} data-city={c} onClick={() => onChange(c)} aria-pressed={value === c} className="chip">{label(c)}</button>
      ))}
      {clip && (
        <div aria-hidden="true" className="seg-active pointer-events-none absolute inset-0 z-[2] flex flex-wrap gap-1 rounded-full p-1" style={{ clipPath: clip }}>
          {options.map((c) => <span key={c} className="chip !text-white">{label(c)}</span>)}
        </div>
      )}
    </div>
  );
}

/** Reveal tiles as they scroll into view, once. Tiles already on screen at load keep their stagger. */
function useReveal(root: React.RefObject<HTMLElement | null>, deps: unknown[]) {
  useEffect(() => {
    const el = root.current;
    if (!el) return;
    const items = [...el.querySelectorAll<HTMLElement>('.reveal:not([data-in])')];
    const io = new IntersectionObserver((entries) => {
      for (const e of entries) {
        if (!e.isIntersecting) continue;
        const t = e.target as HTMLElement;
        t.dataset.in = '';
        io.unobserve(t);
        // Hand transforms back to hover and press once the entrance has played.
        setTimeout(() => { t.dataset.done = ''; }, 900);
      }
    }, { rootMargin: '0px 0px -8% 0px', threshold: 0.12 });
    items.forEach((i) => io.observe(i));
    return () => io.disconnect();
  }, deps);
}

function MemberTile({ style }: { style?: CSSProperties }) {
  return (
    <div className="tile surface-ink reveal flex flex-col justify-between p-5 text-white" style={style}>
      <img src="/brand/doorstep-emblem-v4-white.png" alt="" className="h-8 w-8" />
      <div className="space-y-2">
        <p className="font-display text-lg font-semibold leading-snug text-white" style={{ textWrap: 'balance' } as CSSProperties}>Members book every night out</p>
        <Link to="/join" className="press inline-block text-sm font-semibold text-white underline decoration-amber decoration-2 underline-offset-4">Join Doorstep →</Link>
      </div>
    </div>
  );
}

export default function Discover() {
  const [city, setCity] = useState('all');
  const [leaving, setLeaving] = useState(false);
  const stagger = useRef(true);
  const grid = useRef<HTMLDivElement>(null);
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
  const slow = useAfter(q.isPending, 1000);
  const cities = useMemo(() => [...new Set((q.data ?? []).map((e) => e.venue_city))].sort(), [q.data]);
  const list = (q.data ?? []).filter((e) => city === 'all' || e.venue_city === city);
  const showMember = !(session && member.data);
  // Stagger the entrance on first load only; a filter change just fades.
  useEffect(() => { if (q.isSuccess) { const t = setTimeout(() => { stagger.current = false; }, 600); return () => clearTimeout(t); } }, [q.isSuccess]);

  function pick(c: string) {
    if (c === city) return;
    setLeaving(true);
    setTimeout(() => { setCity(c); setLeaving(false); }, 150);
  }

  useReveal(grid, [city, q.data]);
  const [lead, ...rest] = list;
  const firstRow = rest.slice(0, showMember ? 3 : 4);
  const after = rest.slice(firstRow.length);
  const sizes = bentoSizes(after.length);
  let i = 0;
  const delay = (): CSSProperties => ({ ['--i' as string]: stagger.current ? i++ : 0 });

  return (
    <div className="ambient space-y-8">
      <section className="space-y-3">
        <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.01em] sm:text-6xl">Good nights out, <span className="brand-underline">on your Doorstep.</span></h1>
        <p className="max-w-xl text-lg text-muted">Gigs, comedy, theatre and more at venues near you, at member prices.</p>
      </section>
      {cities.length > 1 && <CityFilter options={['all', ...cities]} value={city} onChange={pick} />}
      {q.isPending && (
        <div className="space-y-4" role="status" aria-label="Finding events">
          <div className="bento-wrap"><div className="bento">
            <TileSkeleton size="big" />{Array.from({ length: 4 }, (_, k) => <TileSkeleton key={k} />)}
            <TileSkeleton size="wide" /><TileSkeleton /><TileSkeleton />
          </div></div>
          {slow && <Loader mode="inline" label="Finding events" />}
        </div>
      )}
      {q.isError && (
        <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">We couldn’t load events just now.</p>
          <button className="btn-secondary !py-2" onClick={() => q.refetch()}>Try again</button>
        </div>
      )}
      {q.isSuccess && list.length === 0 && <Empty title="Nothing on sale yet">New events are added every week. Check back soon.</Empty>}
      {lead && (
        <div className="bento-wrap" ref={grid}><div key={city} className={`bento ${leaving ? 'grid-leaving' : ''}`}>
          <EventTile e={lead} size="big" className="reveal" style={delay()} />
          {firstRow.map((e) => <EventTile key={e.id} e={e} className="reveal" style={delay()} />)}
          {showMember && <MemberTile style={delay()} />}
          {after.map((e, k) => <EventTile key={e.id} e={e} size={sizes[k]} className="reveal" style={delay()} />)}
        </div></div>
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
