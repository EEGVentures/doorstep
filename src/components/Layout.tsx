import { useEffect, useState } from 'react';
import { Link, NavLink, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '@/lib/auth';
import { supabaseConfigured } from '@/lib/supabase';

export default function Layout() {
  const { session } = useAuth();
  const { pathname } = useLocation();
  // Partner links keep a stripped-back header: no membership prompts on that route.
  const partnerRoute = pathname.startsWith('/go/');
  // Header is clear at the top of the page and turns to glass once content scrolls under it.
  const [scrolled, setScrolled] = useState(false);
  useEffect(() => {
    const on = () => setScrolled(window.scrollY > 8);
    on(); window.addEventListener('scroll', on, { passive: true });
    return () => window.removeEventListener('scroll', on);
  }, []);
  const nav = 'press relative isolate rounded-full px-4 py-2 text-sm font-medium text-muted transition-colors duration-200 hover:text-ink aria-[current=page]:text-white';
  // The active pill is its own element with a shared transition name, so it slides between links on navigation.
  const item = (label: string) => ({ isActive }: { isActive: boolean }) => (<>
    {isActive && <span aria-hidden="true" className="nav-pill absolute inset-0 -z-10 rounded-full bg-ink shadow-[inset_0_1px_0_rgba(255,255,255,0.18),0_6px_14px_-6px_rgba(26,16,48,0.5)]" />}
    {label}
  </>);
  return (
    <div className="min-h-screen flex flex-col">
      {!supabaseConfigured && (
        <div className="bg-ink px-4 py-2 text-center text-xs text-white">Preview build: Supabase keys are not set, so no live data.</div>
      )}
      <header className="site-header sticky top-0 z-20 px-3 pt-3">
        <div className={`mx-auto flex max-w-6xl items-center justify-between gap-4 rounded-full border py-2 pl-5 pr-2 transition-[background-color,box-shadow,border-color] duration-200 ${scrolled ? 'glass' : 'border-transparent'}`}>
          <Link to="/" viewTransition aria-label="Doorstep home" className="press shrink-0"><img src="/brand/doorstep-lockup-c-light.png" alt="doorstep" className="h-6 w-auto max-w-none sm:h-7" /></Link>
          <nav className="flex min-w-0 items-center gap-0.5 sm:gap-1">
            {!partnerRoute && <NavLink to="/" end viewTransition className={nav}>{item('Discover')}</NavLink>}
            {session && <NavLink to="/wallet" viewTransition className={nav}>{item('Tickets')}</NavLink>}
            {session ? <NavLink to="/account" viewTransition className={nav}>{item('Account')}</NavLink> : <NavLink to={`/signin?next=${encodeURIComponent(pathname)}`} viewTransition className={nav}>{item('Sign in')}</NavLink>}
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
