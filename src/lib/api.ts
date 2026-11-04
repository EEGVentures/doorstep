import { supabase } from './supabase';

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string) { super(message); }
}

/** Calls a Doorstep server function with the signed-in user's token. */
export async function api<T>(path: string, init: { method?: string; body?: unknown } = {}): Promise<T> {
  const { data } = await supabase.auth.getSession();
  const res = await fetch(`/api/${path}`, {
    method: init.method ?? (init.body ? 'POST' : 'GET'),
    headers: {
      'content-type': 'application/json',
      ...(data.session ? { authorization: `Bearer ${data.session.access_token}` } : {}),
    },
    body: init.body ? JSON.stringify(init.body) : undefined,
  });
  const json = await res.json().catch(() => ({}));
  if (!res.ok) throw new ApiError(res.status, json?.error?.code ?? 'ERROR', json?.error?.message ?? 'Something went wrong. Please try again.');
  return json as T;
}

/** A random first-party id so partner reports count unique visitors without fingerprinting. */
export function visitorId() {
  try {
    let id = localStorage.getItem('ds_vid');
    if (!id) { id = crypto.randomUUID(); localStorage.setItem('ds_vid', id); }
    return id;
  } catch {
    return crypto.randomUUID();
  }
}
