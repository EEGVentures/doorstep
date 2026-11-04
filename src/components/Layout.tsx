import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';

export default function Layout() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  // Partner links keep a stripped-back header: no membership prompts on that route.
  const partnerRoute = pathname.startsWith('/go/');
  const nav = 'rounded-full px-4 py-2 text-sm font-medium text-muted hover:text-ink aria-[current=page]:bg-ink aria-[current=page]:text-white aria-[current=page]:shadow-[inset_0_1px_0_rgba(255,255,255,0.18),inset_0_-4px_8px_-4px_rgba(0,0,0,0.4),0_6px_14px_-6px_rgba(26,16,48,0.5)]';
  return (
    <div className="min-h-screen flex flex-col">
      {!supabaseConfigured && (
        <div className="bg-ink px-4 py-2 text-center text-xs text-white">Preview build: Supabase keys are not set, so no live data.</div>
      )}
      <header className="sticky top-0 z-20 px-3 pt-3">
        <div className="glass mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full py-2 pl-5 pr-2">
          <Link to="/" aria-label="Doorstep home"><img src="/brand/doorstep-lockup-c-light.png" alt="doorstep" className="h-7 w-auto" /></Link>
          <nav className="flex items-center gap-1">
            {!partnerRoute && <NavLink to="/" end className={nav}>Discover</NavLink>}
            {session && <NavLink to="/wallet" className={nav}>Tickets</NavLink>}
            {session ? <NavLink to="/account" className={nav}>Account</NavLink> : <NavLink to={`/signin?next=${encodeURIComponent(pathname)}`} className={nav}>Sign in</NavLink>}
          </nav>
        </div>
      </header>
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8"><Outlet /></main>
      <footer className="border-t border-line">
        <div className="mx-auto flex max-w-6xl flex-col gap-3 px-4 py-8 text-sm text-muted sm:flex-row sm:items-center sm:justify-between">
          <p className="font-display font-semibold text-ink">Good nights out, on your Doorstep.</p>
          <div className="flex flex-wrap gap-4">
            <Link className="link" to="/legal/terms">Terms</Link>
            <Link className="link" to="/legal/privacy">Privacy</Link>
            <Link className="link" to="/legal/refunds">Refunds</Link>
            <Link className="link" to="/press">Press</Link>
            <a className="link" href="mailto:support@doorstep.live">Help</a>
          </div>
        </div>
      </footer>
    </div>
  );
}
