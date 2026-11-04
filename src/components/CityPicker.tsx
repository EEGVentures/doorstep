import { useEffect, useRef, useState } from 'react';
import { BottomSheet } from './BottomSheet';

type City = { name: string; count: number };

/** Small house outline (the emblem's gable) used as each city's marker. Gradient line when it's your doorstep. */
function HouseMark({ on }: { on: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className="h-6 w-6 shrink-0" aria-hidden="true">
      <defs><linearGradient id="cp-g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stopColor="#FF5A5F" /><stop offset="1" stopColor="#FF8A3D" /></linearGradient></defs>
      <path d="M4 21V10l8-6 8 6v11" fill="none" stroke={on ? 'url(#cp-g)' : 'currentColor'} strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
      {on && <path d="M10 21v-5h4v5" fill="none" stroke="url(#cp-g)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
    </svg>
  );
}

function List({ cities, value, onPick, detected }: { cities: City[]; value: string; onPick: (c: string) => void; detected: boolean }) {
  const first = useRef<HTMLButtonElement>(null);
  useEffect(() => { first.current?.focus({ preventScroll: true }); }, []);
  return (
    <div>
      <ul role="listbox" aria-label="Choose your city" className="space-y-1"
        onKeyDown={(e) => {
          if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
          e.preventDefault();
          const items = [...e.currentTarget.querySelectorAll<HTMLButtonElement>('button')];
          const i = items.indexOf(document.activeElement as HTMLButtonElement);
          items[(i + (e.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length]?.focus();
        }}>
        {cities.map((c, i) => {
          const on = c.name === value;
          return (
            <li key={c.name} className="city-item" style={{ ['--i' as string]: i }}>
              <button ref={on ? first : undefined} role="option" aria-selected={on} onClick={() => onPick(c.name)}
                className={`press flex w-full items-center gap-3 rounded-2xl px-3 py-2.5 text-left transition-colors duration-150 ${on ? 'bg-wash' : 'hover:bg-ink/[0.04] focus-visible:bg-ink/[0.04]'}`}>
                <span className={on ? '' : 'text-ink/30'}><HouseMark on={on} /></span>
                <span className="min-w-0 flex-1">
                  <span className="block font-display text-lg font-semibold leading-tight text-ink">{c.name}</span>
                  <span className="block font-sans text-sm font-normal tabular-nums text-muted">{c.count} night{c.count === 1 ? '' : 's'} out</span>
                </span>
                {on && <span className="font-sans text-xs font-semibold text-ink">Your doorstep</span>}
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-3 font-sans text-xs font-normal text-muted">{detected ? `We picked ${value} from your connection. ` : ''}More cities are on the way.</p>
    </div>
  );
}

/**
 * The city lives inside the heading: "What's on in Cardiff ⌄". Tapping the city opens the picker:
 * a glass panel that grows from the city name on desktop, a bottom sheet on phones.
 * Changing city rolls the new name in, like a departures board.
 */
export function CityPicker({ cities, value, onChange, detected }: { cities: City[]; value: string; onChange: (c: string) => void; detected: boolean }) {
  const [open, setOpen] = useState(false);
  const [phone, setPhone] = useState(() => typeof window !== 'undefined' && matchMedia('(max-width: 639px)').matches);
  const wrap = useRef<HTMLSpanElement>(null);
  const trigger = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const m = matchMedia('(max-width: 639px)');
    const on = () => setPhone(m.matches);
    m.addEventListener('change', on);
    return () => m.removeEventListener('change', on);
  }, []);
  useEffect(() => {
    if (!open || phone) return;
    const click = (e: MouseEvent) => { if (!wrap.current?.contains(e.target as Node)) setOpen(false); };
    const key = (e: KeyboardEvent) => { if (e.key === 'Escape') { setOpen(false); trigger.current?.focus(); } };
    document.addEventListener('mousedown', click);
    document.addEventListener('keydown', key);
    return () => { document.removeEventListener('mousedown', click); document.removeEventListener('keydown', key); };
  }, [open, phone]);

  const pick = (c: string) => { setOpen(false); if (c !== value) onChange(c); };

  return (
    <span ref={wrap} className="relative inline-block">
      <button ref={trigger} onClick={() => setOpen((o) => !o)} aria-haspopup="listbox" aria-expanded={open}
        className="city-trigger press inline-flex items-baseline gap-2 text-ink">
        <span className="brand-underline inline-block overflow-hidden align-bottom"><span key={value} className="roll inline-block">{value}</span></span>
        <span className={`city-chevron glass inline-grid h-8 w-8 place-items-center self-center rounded-full sm:h-9 sm:w-9 ${open ? 'is-open' : ''}`} aria-hidden="true">
          <svg viewBox="0 0 24 24" className="h-4 w-4"><path d="M6 9l6 6 6-6" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" /></svg>
        </span>
        <span className="sr-only">, change city</span>
      </button>
      {!phone && open && (
        <span className="city-pop glass absolute left-0 top-full z-30 mt-3 block w-80 rounded-[24px] p-2 font-sans text-base font-normal">
          <List cities={cities} value={value} onPick={pick} detected={detected} />
        </span>
      )}
      {phone && (
        <BottomSheet open={open} onClose={() => setOpen(false)} label="Choose your city">
          <p className="mb-3 px-3 font-display text-xl font-semibold text-ink">Where’s your doorstep?</p>
          <List cities={cities} value={value} onPick={pick} detected={detected} />
        </BottomSheet>
      )}
    </span>
  );
}
