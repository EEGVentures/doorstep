import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import { Link, Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth, useProfile } from '@/lib/auth';
import { eventDateLong } from '@/lib/format';
import { Loader, Notice, PrimaryLink } from '@/components/ui';

type Status = { active: boolean; entitlement: { source: string; status: string; current_period_end: string | null; cancel_at_period_end: boolean } | null };

export default function Account() {
  const { session, ready } = useAuth();
  const [params] = useSearchParams();
  const profile = useProfile();
  const qc = useQueryClient();
  const status = useQuery({ queryKey: ['membership-status'], enabled: Boolean(session), queryFn: () => api<Status>('membership', { body: { action: 'status' } }), refetchInterval: params.get('joined') ? 3000 : false });
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Loader />;
  if (!session) return <Navigate to="/signin?next=/account" replace />;

  async function manage() {
    setError(null);
    try { window.location.assign((await api<{ url: string }>('membership', { body: { action: 'manage' } })).url); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong.'); }
  }
  async function setConsent(v: boolean) {
    await api('me', { body: { marketingEmail: v, source: 'account' } });
    qc.invalidateQueries({ queryKey: ['profile'] });
  }

  const ent = status.data?.entitlement;
  return (
    <div className="mx-auto max-w-2xl space-y-6">
      <h1 className="text-3xl font-bold">Account</h1>
      {params.get('joined') && !status.data?.active && <Notice>Thanks for joining. We’re confirming your membership with Stripe.</Notice>}
      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Membership</h2>
        {status.isPending ? <Loader mode="inline" /> : status.data?.active ? (
          <>
            <p>You’re a member{ent?.source === 'apple' ? ' through the iPhone app' : ''}.
              {ent?.current_period_end && (ent.cancel_at_period_end || ent.status === 'canceled'
                ? ` Your membership ends on ${eventDateLong(ent.current_period_end)}.`
                : ` Next renewal ${eventDateLong(ent.current_period_end)}.`)}</p>
            {ent?.status === 'past_due' && <Notice tone="error">Your last payment didn’t go through. Update your card to keep booking.</Notice>}
            {ent?.source === 'apple'
              ? <p className="text-sm text-muted">Manage or cancel in your iPhone’s Settings, under your name, then Subscriptions.</p>
              : <button className="btn-secondary" onClick={manage}>Manage or cancel membership</button>}
          </>
        ) : (
          <>
            <p className="text-muted">You’re not a member yet. Members can book every event on Doorstep.</p>
            <PrimaryLink to="/join">Become a member</PrimaryLink>
          </>
        )}
        {error && <Notice tone="error">{error}</Notice>}
      </section>
      <section className="card space-y-3 p-6">
        <h2 className="text-lg font-semibold">Details</h2>
        {profile.data && (<>
          <p>{[profile.data.first_name, profile.data.last_name].filter(Boolean).join(' ')}<br /><span className="text-muted">{profile.data.email}</span></p>
          <label className="flex items-center gap-3">
            <input type="checkbox" className="h-4 w-4 accent-ink" checked={profile.data.marketing_email_consent} onChange={(e) => setConsent(e.target.checked)} />
            <span>Email me about good nights out near me</span>
          </label>
        </>)}
      </section>
      <div className="flex flex-wrap gap-3">
        <Link to="/wallet" className="btn-secondary">Your tickets</Link>
        {profile.data && ['ops', 'admin'].includes(profile.data.role) && <Link to="/ops" className="btn-secondary">Operations</Link>}
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}
