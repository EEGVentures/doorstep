import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { supabase } from './supabase';
import { DEMO, demoSession } from '../demo';

export type Profile = { id: string; email: string; first_name: string | null; last_name: string | null; role: string; marketing_email_consent: boolean };

const Ctx = createContext<{ session: Session | null; ready: boolean }>({ session: null, ready: false });

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [ready, setReady] = useState(false);
  const qc = useQueryClient();
  useEffect(() => {
    if (DEMO) { setSession(demoSession()); setReady(true); return; }
    supabase.auth.getSession().then(({ data }) => { setSession(data.session); setReady(true); });
    const { data } = supabase.auth.onAuthStateChange((_e, s) => { setSession(s); qc.invalidateQueries(); });
    return () => data.subscription.unsubscribe();
  }, [qc]);
  return <Ctx.Provider value={{ session, ready }}>{children}</Ctx.Provider>;
}

export const useAuth = () => useContext(Ctx);

export function useProfile() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['profile', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles')
        .select('id, email, first_name, last_name, role, marketing_email_consent').eq('id', session!.user.id).single();
      if (error) throw error;
      return data as Profile;
    },
  });
}

/** Whether the signed-in user is a member right now (database decides, including grace periods). */
export function useMembership() {
  const { session } = useAuth();
  return useQuery({
    queryKey: ['membership', session?.user.id],
    enabled: Boolean(session),
    queryFn: async () => {
      const { data, error } = await supabase.rpc('has_active_membership', { p_user: session!.user.id });
      if (error) throw error;
      return Boolean(data);
    },
  });
}
