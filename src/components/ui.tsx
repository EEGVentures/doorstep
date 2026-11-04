import { useEffect, useRef, type ButtonHTMLAttributes, type ReactNode } from 'react';
import { Link } from 'react-router-dom';

declare global { interface Window { activateDoorstepLoader?: (el: HTMLElement) => () => void } }

/** Shared indeterminate state: mount only while work is pending; never add a delay (brand/02-Motion-Standard). */
export function Loader({ label = 'Loading', mode = 'region' }: { label?: string; mode?: 'region' | 'inline' | 'screen' }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => { if (ref.current) return window.activateDoorstepLoader?.(ref.current); }, []);
  return (
    <div className={`ds-loader ds-loader--${mode}`} ref={ref} role="status" aria-live="polite">
      <span className="ds-loader__art" aria-hidden="true">
        <img className="ds-loader__poster" src="/brand/loader/loader-emblem.png" alt="" />
        <span className="ds-loader__sprite" />
      </span>
      <span className="ds-loader__label">{label}</span>
    </div>
  );
}

export function PrimaryButton({ children, ...rest }: ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button className="btn-primary" {...rest}>
      <span>
        <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="h-5 w-5" />
        {/* Keyed on the label: a state change ("Book now" to "Holding your tickets") swaps through a light blur. */}
        <span key={typeof children === 'string' ? children : undefined} className="swap">{children}</span>
        <span className="arrow" aria-hidden="true">→</span>
      </span>
    </button>
  );
}

export function PrimaryLink({ to, children }: { to: string; children: ReactNode }) {
  return (
    <Link to={to} className="btn-primary">
      <span>
        <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="h-5 w-5" />
        {children}
        <span className="arrow" aria-hidden="true">→</span>
      </span>
    </Link>
  );
}

export function Notice({ tone = 'info', children }: { tone?: 'info' | 'error' | 'success'; children: ReactNode }) {
  const cls = tone === 'error' ? 'border-action/50 bg-white text-ink' : tone === 'success' ? 'border-ink/20 bg-white' : 'border-line bg-white';
  return <div role={tone === 'error' ? 'alert' : 'status'} className={`rounded-xl border px-4 py-3 text-sm ${cls}`}>{children}</div>;
}

export function Empty({ title, children }: { title: string; children?: ReactNode }) {
  return (
    <div className="card p-8 text-center">
      <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="mx-auto mb-4 h-12 w-12" />
      <h2 className="text-xl font-semibold">{title}</h2>
      {children && <div className="mt-2 text-muted">{children}</div>}
    </div>
  );
}

export function Quantity({ value, max, onChange }: { value: number; max: number; onChange: (n: number) => void }) {
  // Remember the previous value so the digit rolls the way the number moved.
  const prev = useRef(value);
  const last = useRef(value);
  if (last.current !== value) { prev.current = last.current; last.current = value; }
  return (
    <div className="inline-flex items-center rounded-full border border-line bg-white" role="group" aria-label="Number of tickets">
      <button type="button" className="press h-10 w-10 rounded-full text-lg disabled:opacity-30" onClick={() => onChange(value - 1)} disabled={value <= 1} aria-label="One fewer">−</button>
      <span className="w-8 overflow-hidden text-center font-semibold tabular-nums" aria-live="polite">
        <span key={value} className="roll" data-dir={value >= prev.current ? 'up' : 'down'}>{value}</span>
      </span>
      <button type="button" className="press h-10 w-10 rounded-full text-lg disabled:opacity-30" onClick={() => onChange(value + 1)} disabled={value >= max} aria-label="One more">+</button>
    </div>
  );
}
