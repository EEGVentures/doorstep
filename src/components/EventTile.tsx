import { Link } from 'react-router-dom';
import { eventDate, eventTime, pounds } from '@/lib/format';
import type { Listing } from '@/pages/Discover';

/** Bento tile: full-bleed event image with a Liquid Glass caption. */
export function EventTile({ e, size = 'sq' }: { e: Listing; size?: 'sq' | 'big' | 'wide' }) {
  const soldOut = e.status === 'sold_out' || e.tickets_left === 0;
  const big = size === 'big';
  return (
    <Link to={`/events/${e.slug}`} className={`tile card ${big ? 'tile-big' : size === 'wide' ? 'tile-wide' : ''} ${e.image_url ? '' : 'tile-wash'}`}>
      {e.image_url
        ? <img className="tile-bg" src={e.image_url} alt="" loading="lazy" />
        : <img className="emblem-3d absolute left-1/2 top-[30%] w-1/3 max-w-[120px] -translate-x-1/2 -translate-y-1/2" src="/brand/doorstep-emblem-v4-gradient.png" alt="" />}
      <span className="glass absolute left-1/2 top-3 -translate-x-1/2 whitespace-nowrap rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.1em] text-ink sm:left-3 sm:translate-x-0">
        {eventDate(e.starts_at, e.timezone)} · {eventTime(e.starts_at, e.timezone)}
      </span>
      <div className={`glass absolute inset-x-2 bottom-2 rounded-[22px] ${big ? 'p-5 sm:inset-x-3 sm:bottom-3' : 'p-3'}`}>
        <h2 className={`font-display font-semibold leading-snug text-ink ${big ? 'text-2xl sm:text-3xl' : 'line-clamp-2 text-[15px] sm:text-base'}`}>{e.title}</h2>
        <p className={`truncate text-ink/75 ${big ? 'text-base' : 'text-xs sm:text-sm'}`}>{e.venue_name}, {e.venue_city}</p>
        <p className={`mt-1 font-semibold text-ink ${big ? 'text-base' : 'text-xs sm:text-sm'}`}>{soldOut ? 'Sold out' : `From ${pounds(e.from_price_pence)}`}</p>
      </div>
    </Link>
  );
}
