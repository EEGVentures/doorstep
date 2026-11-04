import { Link } from 'react-router-dom';
import type { CSSProperties } from 'react';
import { eventDate, eventTime, pounds } from '@/lib/format';
import type { Listing } from '@/pages/Discover';

export type TileSize = 'sm' | 'wide' | 'big';

/** Shared-element name: the tile photo and the event hero carry the same one, so the photo grows into the hero. */
export const photoName = (slug: string) => `photo-${slug.replace(/[^a-z0-9-]/gi, '')}`;

/**
 * Bento tile. Photo tiles: caption sits on the photo over a dark fade in white text (no glass slab).
 * The date pill is the only glass on the tile (dark glass, since it floats over a photo).
 * Events without an image get a typographic tile instead of a placeholder emblem.
 */
export function EventTile({ e, size = 'sm', style, className = '' }: { e: Listing; size?: TileSize; style?: CSSProperties; className?: string }) {
  const soldOut = e.status === 'sold_out' || e.tickets_left === 0;
  const big = size === 'big';
  const photo = Boolean(e.image_url);
  const sizeCls = big ? 'tile-big' : size === 'wide' ? 'tile-wide' : '';
  const when = `${eventDate(e.starts_at, e.timezone)} · ${eventTime(e.starts_at, e.timezone)}`;
  return (
    <Link to={`/events/${e.slug}`} viewTransition style={style}
      className={`tile ${sizeCls} ${photo ? '' : 'tile-wash'} ${soldOut ? 'tile-soldout' : ''} ${className}`}
      aria-label={`${e.title}, ${e.venue_name}, ${when}${soldOut ? ', sold out' : ''}`}>
      {photo && <>
        <img className="tile-bg" src={e.image_url!} alt="" loading={big ? 'eager' : 'lazy'} style={{ viewTransitionName: photoName(e.slug) }} />
        <span className="tile-fade" />
      </>}
      <span className={`absolute left-3 top-3 whitespace-nowrap rounded-full px-3 py-1 text-xs font-medium tabular-nums ${photo ? 'glass-dark' : 'glass text-ink'}`}>{when}</span>
      <span className={`absolute inset-x-0 bottom-0 flex flex-col ${big ? 'p-5 sm:p-7' : 'p-3 sm:p-4'} ${photo ? 'text-white' : 'text-ink'}`}>
        {e.category && <span className={`text-xs font-medium ${photo ? 'text-white/75' : 'text-ink/60'}`}>{e.category}</span>}
        <span className={`font-display font-semibold leading-tight ${big ? 'text-3xl sm:text-4xl' : photo ? 'line-clamp-2 text-[15px] sm:text-lg' : 'line-clamp-3 text-lg sm:text-2xl'}`}
          style={{ textWrap: 'balance' } as CSSProperties}>{e.title}</span>
        <span className={`mt-0.5 truncate ${big ? 'text-base' : 'text-xs sm:text-sm'} ${photo ? 'text-white/80' : 'text-ink/70'}`}>{e.venue_name}, {e.venue_city}</span>
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
