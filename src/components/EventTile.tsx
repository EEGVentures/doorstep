import { Link } from 'react-router-dom';
import { useRef, type CSSProperties, type PointerEvent } from 'react';
import { eventDate, eventTime, pounds } from '@/lib/format';
import type { Listing } from '@/pages/Discover';

export type TileSize = 'sm' | 'wide' | 'big' | 'full';

/** Marks the next view transition as a "door opening" (the event page opens from the middle, like double doors). */
export function doorOpen() {
  const root = document.documentElement;
  root.dataset.vt = 'door';
  setTimeout(() => { if (root.dataset.vt === 'door') delete root.dataset.vt; }, 900);
}

const canDrift = () => typeof window !== 'undefined'
  && matchMedia('(hover: hover) and (pointer: fine)').matches && !matchMedia('(prefers-reduced-motion: reduce)').matches;

/**
 * Lead tile only: the photo drifts a few pixels against the pointer, smoothed by a critically damped spring
 * so it has weight instead of snapping to the mouse. Writes transform straight to the image (no React renders).
 */
function useDrift() {
  const img = useRef<HTMLImageElement>(null);
  const st = useRef({ x: 0, y: 0, s: 1, vx: 0, vy: 0, vs: 0, tx: 0, ty: 0, ts: 1, raf: 0, last: 0 });
  const step = (now: number) => {
    const a = st.current, dt = Math.min(32, now - (a.last || now)) / 1000; a.last = now;
    const k = 120, c = 2 * Math.sqrt(k); // stiffness, critical damping
    for (const [p, v, t] of [['x', 'vx', 'tx'], ['y', 'vy', 'ty'], ['s', 'vs', 'ts']] as const) {
      const acc = k * (a[t] - a[p]) - c * a[v];
      a[v] += acc * dt; a[p] += a[v] * dt;
    }
    if (img.current) img.current.style.transform = `translate3d(${a.x.toFixed(2)}px, ${a.y.toFixed(2)}px, 0) scale(${a.s.toFixed(4)})`;
    const moving = Math.abs(a.tx - a.x) + Math.abs(a.ty - a.y) + Math.abs(a.ts - a.s) * 100 + Math.abs(a.vx) + Math.abs(a.vy) > 0.02;
    a.raf = moving ? requestAnimationFrame(step) : 0;
    if (!moving) a.last = 0;
  };
  const kick = () => { if (!st.current.raf) st.current.raf = requestAnimationFrame(step); };
  return {
    img,
    onPointerMove: (e: PointerEvent<HTMLElement>) => {
      if (e.pointerType !== 'mouse' || !canDrift()) return;
      const r = e.currentTarget.getBoundingClientRect();
      const nx = (e.clientX - r.left) / r.width - 0.5, ny = (e.clientY - r.top) / r.height - 0.5;
      Object.assign(st.current, { tx: nx * -14, ty: ny * -14, ts: 1.05 }); kick();
    },
    onPointerLeave: () => { Object.assign(st.current, { tx: 0, ty: 0, ts: 1 }); kick(); },
  };
}

/** Shared-element name: the tile photo and the event hero carry the same one, so the photo grows into the hero. */
export const photoName = (slug: string) => `photo-${slug.replace(/[^a-z0-9-]/gi, '')}`;

/**
 * Bento tile. Photo tiles: caption sits on the photo over a dark fade in white text (no glass slab).
 * The date pill is the only glass on the tile (dark glass, since it floats over a photo).
 * Events without an image get a typographic tile instead of a placeholder emblem.
 */
export function EventTile({ e, size = 'sm', style, className = '', away }: { e: Listing; size?: TileSize; style?: CSSProperties; className?: string; away?: string }) {
  const soldOut = e.status === 'sold_out' || e.tickets_left === 0;
  const big = size === 'big';
  const photo = Boolean(e.image_url);
  const dark = photo || (!photo && size === 'big');
  const sizeCls = big ? 'tile-big' : size === 'wide' ? 'tile-wide' : size === 'full' ? 'tile-full' : '';
  const ink = !e.image_url && big; // a photo-less lead tile goes ink so the house shape still reads
  const drift = useDrift();
  const when = `${eventDate(e.starts_at, e.timezone)} · ${eventTime(e.starts_at, e.timezone)}`;
  return (
    <Link to={`/events/${e.slug}`} viewTransition style={style} onClick={doorOpen}
      onPointerMove={big ? drift.onPointerMove : undefined} onPointerLeave={big ? drift.onPointerLeave : undefined}
      className={`tile ${big ? 'tile-house' : ''} ${sizeCls} ${photo ? '' : ink ? 'surface-ink' : 'tile-wash'} ${soldOut ? 'tile-soldout' : ''} ${className}`}
      aria-label={`${e.title}, ${e.venue_name}, ${when}${away ? `, ${away}` : ''}${soldOut ? ', sold out' : ''}`}>
      {photo && <>
        <img ref={big ? drift.img : undefined} className={`tile-bg ${big ? 'tile-drift' : ''}`} src={e.image_url!} alt="" loading={big ? 'eager' : 'lazy'} style={{ viewTransitionName: photoName(e.slug) }} />
        <span className="tile-fade" />
      </>}
      <span className={`absolute whitespace-nowrap ${big ? 'house-sign' : 'left-3 top-3'} rounded-full px-3 py-1 text-xs font-medium tabular-nums ${dark ? 'glass-dark' : 'glass text-ink'}`}>{when}</span>
      <span className={`absolute inset-x-0 bottom-0 flex flex-col ${big ? 'p-5 sm:p-7' : 'p-3 sm:p-4'} ${dark ? 'text-white' : 'text-ink'}`}>
        {e.category && <span className={`text-xs font-medium ${dark ? 'text-white/75' : 'text-ink/60'}`}>{e.category}</span>}
        <span className={`font-display font-semibold leading-tight ${big ? 'text-3xl sm:text-4xl' : photo ? 'line-clamp-2 text-[15px] sm:text-lg' : 'line-clamp-3 text-lg sm:text-2xl'}`}
          style={{ textWrap: 'balance' } as CSSProperties}>{e.title}</span>
        <span className={`mt-0.5 truncate ${big ? 'text-base' : 'text-xs sm:text-sm'} ${dark ? 'text-white/80' : 'text-ink/70'}`}>{e.venue_name}{away ? <> · <span className="tabular-nums">{away}</span></> : `, ${e.venue_city}`}</span>
        {soldOut
          ? <span className="mt-1.5 w-fit rounded-full bg-white px-2.5 py-0.5 text-xs font-semibold text-ink">Sold out</span>
          : <span className={`mt-1 font-semibold tabular-nums ${big ? 'text-base' : 'text-xs sm:text-sm'}`}>From {pounds(e.from_price_pence)}</span>}
      </span>
    </Link>
  );
}

export function TileSkeleton({ size = 'sm' }: { size?: TileSize }) {
  return <div className={`skeleton ${size === 'big' ? 'tile-big' : size === 'wide' ? 'tile-wide' : ''}`} aria-hidden="true" />;
}
