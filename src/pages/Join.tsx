import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { Navigate, useSearchParams } from 'react-router-dom';
import { api, ApiError } from '@/lib/api';
import { useAuth, useMembership } from '@/lib/auth';
import { pounds2 } from '@/lib/format';
import { Loader, Notice, PrimaryButton, PrimaryLink } from '@/components/ui';

type Status = { active: boolean; price: { amount_pence: number; interval: string }; trialDays: number };

export default function Join() {
  const { session, ready } = useAuth();
  const [params] = useSearchParams();
  const member = useMembership();
  const status = useQuery({ queryKey: ['membership-status'], enabled: Boolean(session), queryFn: () => api<Status>('membership', { body: { action: 'status' } }) });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  if (!ready) return <Loader />;
  if (!session) return <Navigate to={`/signin?next=${encodeURIComponent('/join' + window.location.search)}`} replace />;
  if (member.data) return (
    <div className="mx-auto max-w-lg space-y-4"><h1 className="text-3xl font-bold">You’re a member</h1><PrimaryLink to={params.get('next') ?? '/'}>Find a night out</PrimaryLink></div>
  );

  async function join() {
    setBusy(true); setError(null);
    try { window.location.assign((await api<{ url: string }>('membership', { body: { action: 'join' } })).url); }
    catch (e) { setError(e instanceof ApiError ? e.message : 'Something went wrong.'); setBusy(false); }
  }

  const p = status.data?.price;
  return (
    <div className="mx-auto max-w-lg space-y-6">
      <p className="eyebrow">Doorstep membership</p>
      <h1 className="text-4xl font-bold">Every night out, <span className="underline decoration-coral decoration-4 underline-offset-8">open to you.</span></h1>
      <ul className="space-y-2 text-ink">
        <li>✓ Book any event on Doorstep at member prices</li>
        <li>✓ Tickets straight to your wallet, 48 hours before doors</li>
        <li>✓ Cancel online at any time, in a couple of clicks</li>
      </ul>
      <div className="card space-y-4 p-6">
        {status.isPending ? <Loader mode="inline" /> : p && (
          <p className="text-2xl font-semibold">{pounds2(p.amount_pence)}<span className="text-base font-normal text-muted"> a {p.interval}</span></p>
        )}
        {status.data && status.data.trialDays > 0 && <p className="text-sm">Your first {status.data.trialDays} days are free.</p>}
        {params.get('cancelled') && <Notice>No problem, you haven’t been charged.</Notice>}
        {error && <Notice tone="error">{error}</Notice>}
        <PrimaryButton onClick={join} disabled={busy || !p}>{busy ? 'One moment' : 'Join Doorstep'}</PrimaryButton>
        <p className="text-xs text-muted">Renews monthly until you cancel. We email you before each renewal. Payments are handled securely by Stripe.</p>
      </div>
    </div>
  );
}
