import { useQueryClient } from '@tanstack/react-query';
import { Link, Navigate } from 'react-router-dom';
import { api } from '@/lib/api';
import { supabase } from '@/lib/supabase';
import { useAuth, useProfile } from '@/lib/auth';
import { Loader } from '@/components/ui';

export default function Account() {
  const { session, ready } = useAuth();
  const profile = useProfile();
  const qc = useQueryClient();

  if (!ready) return <Loader />;
  if (!session) return <Navigate to="/signin?next=/account" replace />;

  async function setConsent(v: boolean) {
    await api('me', { body: { marketingEmail: v, source: 'account' } });
    qc.invalidateQueries({ queryKey: ['profile'] });
  }

  return (
    <div className="ambient mx-auto max-w-3xl space-y-6">
      <h1 className="text-3xl font-bold">Account</h1>
      <div className="grid gap-4 sm:grid-cols-2">
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
      <Link to="/wallet" className="tile card tile-wash flex aspect-[2/1] flex-col justify-between p-6 sm:aspect-auto">
        <img src="/brand/doorstep-emblem-v4-gradient.png" alt="" className="h-10 w-10" />
        <span className="font-display text-lg font-semibold">Your tickets →</span>
      </Link>
      </div>
      <div className="flex flex-wrap gap-3">
        {profile.data && ['ops', 'admin'].includes(profile.data.role) && <Link to="/ops" className="btn-secondary">Operations</Link>}
        <button className="btn-secondary" onClick={() => supabase.auth.signOut()}>Sign out</button>
      </div>
    </div>
  );
}
