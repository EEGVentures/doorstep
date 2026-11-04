import { useState, type FormEvent } from 'react';
import { supabase } from '@/lib/supabase';
import { api } from '@/lib/api';
import { Notice, PrimaryButton } from './ui';

/**
 * Sign up or sign in, inline. Used on its own page and on partner links,
 * where it is the only step between the visitor and checkout (no membership wall).
 */
export function AuthForm({ onDone, source = 'signup', cta }: { onDone: () => void; source?: 'signup' | 'affiliate_checkout'; cta?: string }) {
  const [mode, setMode] = useState<'signup' | 'signin'>('signup');
  const [first, setFirst] = useState('');
  const [last, setLast] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [optIn, setOptIn] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setInfo(null);
    try {
      if (mode === 'signup') {
        const { data, error } = await supabase.auth.signUp({
          email, password,
          options: { data: { first_name: first.trim(), last_name: last.trim() }, emailRedirectTo: window.location.href },
        });
        if (error) throw error;
        if (!data.session) {
          setInfo('Check your inbox to confirm your email, then come back to this page.');
          return;
        }
        // Consent is its own explicit choice, recorded with a timestamp. Unticked means no marketing.
        await api('me', { body: { marketingEmail: optIn, source } });
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
      }
      onDone();
    } catch (err) {
      setError((err as Error).message || 'That did not work. Please try again.');
    } finally {
      setBusy(false);
    }
  }

  return (
    <form onSubmit={submit} className="space-y-4" noValidate>
      {mode === 'signup' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className="label" htmlFor="first">First name</label><input id="first" className="field" required autoComplete="given-name" value={first} onChange={(e) => setFirst(e.target.value)} /></div>
          <div><label className="label" htmlFor="last">Last name</label><input id="last" className="field" required autoComplete="family-name" value={last} onChange={(e) => setLast(e.target.value)} /></div>
        </div>
      )}
      <div><label className="label" htmlFor="email">Email</label><input id="email" type="email" className="field" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></div>
      <div><label className="label" htmlFor="pw">Password</label><input id="pw" type="password" className="field" required minLength={8} autoComplete={mode === 'signup' ? 'new-password' : 'current-password'} value={password} onChange={(e) => setPassword(e.target.value)} /></div>
      {mode === 'signup' && (
        <label className="flex items-start gap-3 text-sm text-muted">
          <input type="checkbox" className="mt-1 h-4 w-4 accent-ink" checked={optIn} onChange={(e) => setOptIn(e.target.checked)} />
          <span>Email me about good nights out near me. You can unsubscribe at any time.</span>
        </label>
      )}
      {error && <Notice tone="error">{error}</Notice>}
      {info && <Notice>{info}</Notice>}
      <PrimaryButton type="submit" disabled={busy}>{busy ? 'One moment' : cta ?? (mode === 'signup' ? 'Create account' : 'Sign in')}</PrimaryButton>
      <p className="text-sm text-muted">
        {mode === 'signup' ? 'Already have an account? ' : 'New to Doorstep? '}
        <button type="button" className="link" onClick={() => setMode(mode === 'signup' ? 'signin' : 'signup')}>{mode === 'signup' ? 'Sign in' : 'Create an account'}</button>
      </p>
    </form>
  );
}
