import { useQuery } from '@tanstack/react-query';
import { useEffect, useLayoutEffect, useMemo, useRef, useState, type CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { supabase } from '@/lib/supabase';
import { useAuth, useMembership } from '@/lib/auth';
import { useCity } from '@/lib/city';
import { Empty, Loader, PrimaryLink } from '@/components/ui';
import { EventTile, TileSkeleton, type TileSize } from '@/components/EventTile';
import { CityPicker } from '@/components/CityPicker';

export type Listing = {
  id: string; slug: string; title: string; image_url: string | null; category: string | null; starts_at: string; doors_at: string;
  status: string; venue_name: string; venue_city: string; timezone: string; from_price_pence: number | null; tickets_left: number;
  venue_lat?: number | null; venue_lng?: number | null; house_favourite?: boolean;
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
    else if (left === 1) out.push('full');
    else out.push('sm', 'sm', 'sm', 'sm');
    row++;
  }
  return out.slice(0, n);
}

/**
 * Glass segmented control. A white-on-ink copy of the options sits on top, clipped to the selected one, and the clip
 * moves between options. The text changes colour exactly where the pill is, which per-chip colour transitions can't do.
 */
function Segmented<T extends string>({ options, value, onChange, label }: { options: { value: T; label: string }[]; value: T; onChange: (v: T) => void; label: string }) {
  const wrap = useRef<HTMLDivElement>(null);
  const [clip, setClip] = useState<string | null>(null);
  const sig = options.map((o) => o.value).join('|');
  useLayoutEffect(() => {
    const measure = () => {
      const box = wrap.current;
      const el = box?.querySelector<HTMLButtonElement>(`[data-v="${CSS.escape(value)}"]`);
      if (!box || !el) return;
      const right = box.clientWidth - el.offsetLeft - el.offsetWidth;
      const bottom = box.clientHeight - el.offsetTop - el.offsetHeight;
      setClip(`inset(${el.offsetTop}px ${right}px ${bottom}px ${el.offsetLeft}px round 999px)`);
    };
    measure();
    window.addEventListener('resize', measure);
    return () => window.removeEventListener('resize', measure);
  }, [value, sig]);
  return (
    <div ref={wrap} className="glass relative flex w-full flex-nowrap gap-1 rounded-full p-1 sm:inline-flex sm:w-auto" role="group" aria-label={label}>
      {options.map((o) => <button key={o.value} data-v={o.value} onClick={() => onChange(o.value)} aria-pressed={value === o.value} className="chip seg-chip">{o.label}</button>)}
      {clip && (
        <div aria-hidden="true" className="seg-active pointer-events-none absolute inset-0 z-[2] flex flex-nowrap gap-1 rounded-full p-1" style={{ clipPath: clip }}>
          {options.map((o) => <span key={o.value} className="chip seg-chip !text-white">{o.label}</span>)}
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

type When = 'any' | 'tonight' | 'weekend' | 'week';
const WHEN: { value: When; label: string }[] = [
  { value: 'any', label: 'Any night' }, { value: 'tonight', label: 'Tonight' }, { value: 'weekend', label: 'This weekend' }, { value: 'week', label: 'This week' },
];
const HEADING: Record<When, string> = { any: 'What’s on in', tonight: 'Tonight in', weekend: 'This weekend in', week: 'This week in' };

function inWindow(iso: string, when: When, now = new Date()) {
  const t = new Date(iso);
  if (when === 'any') return true;
  const startOfDay = new Date(now); startOfDay.setHours(0, 0, 0, 0);
  if (when === 'tonight') return t >= now && t.getTime() < startOfDay.getTime() + 86400e3 + 4 * 3600e3; // tonight runs to 4am
  if (when === 'week') return t.getTime() < now.getTime() + 7 * 86400e3;
  // This weekend: Friday 5pm to Sunday midnight (the current one if we're in it).
  const dow = now.getDay(); // 0 Sun ... 6 Sat
  const fri = new Date(startOfDay); fri.setDate(fri.getDate() + (dow === 0 ? -2 : dow === 6 ? -1 : 5 - dow)); fri.setHours(17);
  const mon = new Date(fri); mon.setDate(fri.getDate() + 3); mon.setHours(0);
  return t >= fri && t < mon;
}

function MemberTile({ style }: { style?: CSSProperties }) {
  return (
    <div className="tile surface-ink reveal flex flex-col justify-between p-5 text-white" style={style}>
      <img src="/brand/doorstep-emblem-v4-white.png" alt="" className="h-8 w-8" />
      <div className="space-y-2">
        <p className="font-display text-lg font-semibold leading-snug text-white" style={{ textWrap: 'balance' } as CSSProperties}>Every night out on your doorstep, at member prices</p>
        <Link to="/join" className="press inline-block text-sm font-semibold text-white underline decoration-amber decoration-2 underline-offset-4">Join Doorstep →</Link>
      </div>
    </div>
  );
}

export default function Discover() {
  const [when, setWhen] = useState<When>('any');
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
  const showMember = !(session && member.data);

  const { cities, city, choose, detected } = useCity(q.data);
  const near = useMemo(() => (q.data ?? []).filter((e) => e.venue_city === city && inWindow(e.starts_at, when)).map((e) => ({ e })),
    [q.data, when, city]);

  useEffect(() => { if (q.isSuccess) { const t = setTimeout(() => { stagger.current = false; }, 600); return () => clearTimeout(t); } }, [q.isSuccess]);
  useReveal(grid, [when, city, q.data]);

  function pick(v: When) {
    if (v === when) return;
    setLeaving(true);
    setTimeout(() => { setWhen(v); setLeaving(false); }, 150);
  }
  function pickCity(c: string) {
    if (c === city) return;
    setLeaving(true);
    setTimeout(() => { choose(c); setLeaving(false); }, 150);
  }

  // Lead with the soonest House favourite (staff pick) in view; otherwise the soonest night with a photo.
  const favIdx = near.findIndex((x) => x.e.house_favourite && x.e.image_url);
  const leadIdx = favIdx >= 0 ? favIdx : Math.max(0, near.findIndex((x) => x.e.image_url));
  const [lead, ...rest] = near.length ? [near[leadIdx], ...near.filter((_, k) => k !== leadIdx)] : [];
  const firstRow = rest.slice(0, showMember ? 3 : 4);
  const after = rest.slice(firstRow.length);
  // Everything around the lead is a same-size thumbnail, so the House favourite is the one big moment.
  const sizes: TileSize[] = after.map(() => 'sm');
  let i = 0;
  const delay = (): CSSProperties => ({ ['--i' as string]: stagger.current ? i++ : 0 });

  return (
    <div className="ambient space-y-8">
      <section className="space-y-5">
        <h1 className="text-4xl font-bold leading-[1.08] tracking-[-0.01em] sm:text-6xl">Good nights out, <span className="brand-underline">on your Doorstep.</span></h1>
        <p className="max-w-xl text-lg text-muted">Gigs, comedy, theatre and more at venues near you, at member prices.</p>
      </section>

      {q.isPending && (
        <div className="space-y-4" role="status" aria-label="Finding nights out near you">
          <div className="bento-wrap"><div className="bento">
            <TileSkeleton size="big" />{Array.from({ length: 4 }, (_, k) => <TileSkeleton key={k} />)}
            <TileSkeleton size="wide" /><TileSkeleton /><TileSkeleton />
          </div></div>
          {slow && <Loader mode="inline" label="Finding nights out near you" />}
        </div>
      )}
      {q.isError && (
        <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">We couldn’t load what’s on just now.</p>
          <button className="btn-secondary !py-2" onClick={() => q.refetch()}>Try again</button>
        </div>
      )}

      {q.isSuccess && city && (
        <section className="space-y-4">
          <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-end sm:justify-between">
            <div>
              <h2 className="text-3xl font-semibold leading-tight sm:text-4xl">
                {HEADING[when]} <CityPicker cities={cities} value={city} onChange={pickCity} detected={detected} />
              </h2>
              <p className="mt-1 text-sm tabular-nums text-muted">{near.length} night{near.length === 1 ? '' : 's'} out{detected ? ', picked from your connection' : ''}</p>
            </div>
            <Segmented label="When" options={WHEN} value={when} onChange={pick} />
          </div>
          {near.length === 0 || !lead ? (
            <Empty title={when === 'tonight' ? 'Nothing on tonight, yet' : 'It’s quiet on your doorstep'}>
              New nights out land every week. Try another night, or another city.
            </Empty>
          ) : (
            <div className="bento-wrap" ref={grid}><div key={when + city} className={`bento ${leaving ? 'grid-leaving' : ''}`}>
              <EventTile e={lead.e} size="big" className="reveal" style={delay()} />
              {firstRow.map((x) => <EventTile key={x.e.id} e={x.e} className="reveal" style={delay()} />)}
              {showMember && <MemberTile style={delay()} />}
              {after.map((x, k) => <EventTile key={x.e.id} e={x.e} size={sizes[k]} className="reveal" style={delay()} />)}
            </div></div>
          )}
        </section>
      )}

      {session && !member.data && member.isSuccess && (
        <div className="card flex flex-col items-start gap-3 p-6 sm:flex-row sm:items-center sm:justify-between">
          <p className="font-medium">You’re not a member yet. Join to book any night out.</p>
          <PrimaryLink to="/join">Become a member</PrimaryLink>
        </div>
      )}
    </div>
  );
}
