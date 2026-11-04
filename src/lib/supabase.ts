import { createClient } from '@supabase/supabase-js';

// The anon key is public by design; row-level security decides what it can read.
const url = import.meta.env.VITE_SUPABASE_URL as string | undefined;
const anon = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined;
export const supabaseConfigured = Boolean(url && anon);

export const supabase = createClient(url || 'http://localhost:54321', anon || 'public-anon-key-not-set', {
  auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
});
