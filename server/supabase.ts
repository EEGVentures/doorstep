import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import type { VercelRequest } from '@vercel/node';
import { env } from './env.js';
import { HttpError } from './http.js';

let admin: SupabaseClient | undefined;

/** Service-role client. Bypasses RLS, so only server code may use it. */
export function db(): SupabaseClient {
  if (!admin) {
    const e = env();
    admin = createClient(e.SUPABASE_URL, e.SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }
  return admin;
}

export type Profile = {
  id: string;
  email: string;
  first_name: string | null;
  last_name: string | null;
  role: 'customer' | 'promoter' | 'ops' | 'admin';
  stripe_customer_id: string | null;
};

/** Verifies the caller's Supabase access token and loads their profile. */
export async function requireUser(req: VercelRequest): Promise<Profile> {
  const header = req.headers.authorization ?? '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in.');
  const { data, error } = await db().auth.getUser(token);
  if (error || !data.user) throw new HttpError(401, 'UNAUTHENTICATED', 'Please sign in again.');
  const { data: profile, error: pErr } = await db()
    .from('profiles')
    .select('id, email, first_name, last_name, role, stripe_customer_id')
    .eq('id', data.user.id)
    .single();
  if (pErr || !profile) throw new HttpError(403, 'NO_PROFILE', 'Your account is not set up yet.');
  return profile as Profile;
}

export async function requireStaff(req: VercelRequest, roles: Profile['role'][] = ['ops', 'admin']) {
  const user = await requireUser(req);
  if (!roles.includes(user.role)) throw new HttpError(403, 'FORBIDDEN', 'You do not have access to this.');
  return user;
}

export async function audit(actor: string | null, action: string, subjectType: string, subjectId: string | null, detail: object = {}) {
  await db().from('audit_events').insert({ actor, action, subject_type: subjectType, subject_id: subjectId, detail });
}
