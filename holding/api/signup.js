// POST /api/signup: stores a "first access" sign-up in Supabase (public.launch_signups).
// Env (Vercel project for the holding page): SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (server only, never VITE_),
// optional HOLDING_IP_SALT. HOLDING_PREVIEW=1 turns storage off for a demo copy. Bot protection: same-origin check, hidden honeypot field, minimum fill time,
// and a per-IP hourly limit enforced in the database. Never logs email addresses.
import { createHash } from 'node:crypto';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
const MIN_FILL_MS = 2500;
const ALLOWED_HOSTS = new Set(['doorsteptickets.com', 'www.doorsteptickets.com', 'doorsteptickets.co.uk', 'www.doorsteptickets.co.uk', 'doorstep.live', 'www.doorstep.live']);

function send(res, status, body) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
}

function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  if (host === req.headers.host) return true;
  if (ALLOWED_HOSTS.has(host)) return true;
  return host.endsWith('.vercel.app') && host === (req.headers['x-forwarded-host'] || req.headers.host);
}

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 4096) throw new Error('too large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'bad_request' });

  // Bots: filled the hidden field, or submitted faster than a person can type. Pretend it worked.
  const elapsed = Number(body.elapsed_ms);
  if ((typeof body.website === 'string' && body.website.trim() !== '') || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS) {
    return send(res, 200, { ok: true });
  }

  const email = typeof body.email === 'string' ? body.email.trim() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return send(res, 400, { error: 'bad_email' });
  const marketing = body.marketing === true;
  const consentText = marketing && typeof body.consent_text === 'string' ? body.consent_text.slice(0, 500) : null;
  if (marketing && !consentText) return send(res, 400, { error: 'bad_request' });
  const source = typeof body.source === 'string' ? body.source.replace(/[^\w.-]/g, '').slice(0, 64) || null : null;

  // Preview projects (e.g. preview.doorsteptickets.com for colleagues) accept the form without storing anything.
  if (process.env.HOLDING_PREVIEW === '1') return send(res, 200, { ok: true, preview: true });

  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) {
    console.error('signup: Supabase env vars missing');
    return send(res, 503, { error: 'unavailable' });
  }

  const ip = String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
  const salt = process.env.HOLDING_IP_SALT || key;
  const ipHash = createHash('sha256').update(`${salt}:${ip}`).digest('hex');

  const headers = { 'content-type': 'application/json', apikey: key };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`; // legacy JWT keys also need the bearer header

  try {
    const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/register_launch_interest`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ p_email: email, p_marketing: marketing, p_consent_text: consentText, p_source: source, p_ip_hash: ipHash }),
    });
    if (r.ok) return send(res, 200, { ok: true });
    const text = await r.text();
    if (text.includes('DS_RATE_LIMITED')) return send(res, 429, { error: 'rate_limited' });
    if (text.includes('DS_BAD_EMAIL')) return send(res, 400, { error: 'bad_email' });
    console.error('signup: database error', r.status, text.replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 300));
    return send(res, 502, { error: 'unavailable' });
  } catch (e) {
    console.error('signup: request failed', e && e.name);
    return send(res, 502, { error: 'unavailable' });
  }
}
