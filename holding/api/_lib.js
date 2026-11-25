// Shared helpers for the holding page functions. Files starting with "_" are not deployed as routes.
import { createHash } from 'node:crypto';

export const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;
export const MIN_FILL_MS = 2500;
const ALLOWED_HOSTS = new Set([
  'doorsteptickets.com', 'www.doorsteptickets.com', 'preview.doorsteptickets.com',
  'doorsteptickets.co.uk', 'www.doorsteptickets.co.uk', 'doorstep.live', 'www.doorstep.live',
]);

// Only the real domain stores sign-ups and sends email. Every other host (preview.doorsteptickets.com,
// *.vercel.app) is a demo: forms answer "ok" and nothing is saved or sent. HOLDING_PREVIEW=1 forces demo everywhere.
const LIVE_HOSTS = new Set(['doorsteptickets.com', 'www.doorsteptickets.com']);
export function isPreview(req) {
  if (process.env.HOLDING_PREVIEW === '1') return true;
  const host = String(req.headers['x-forwarded-host'] || req.headers.host || '').toLowerCase().split(':')[0];
  return !LIVE_HOSTS.has(host);
}

export function send(res, status, body) {
  res.setHeader('cache-control', 'no-store');
  res.setHeader('content-type', 'application/json; charset=utf-8');
  res.status(status).send(JSON.stringify(body));
}

export function sameOrigin(req) {
  const origin = req.headers.origin;
  if (!origin) return false;
  let host;
  try { host = new URL(origin).host; } catch { return false; }
  if (host === req.headers.host) return true;
  if (ALLOWED_HOSTS.has(host)) return true;
  return host.endsWith('.vercel.app') && host === (req.headers['x-forwarded-host'] || req.headers.host);
}

export async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  if (typeof req.body === 'string') return JSON.parse(req.body);
  const chunks = [];
  let size = 0;
  for await (const c of req) { size += c.length; if (size > 8192) throw new Error('too large'); chunks.push(c); }
  return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}');
}

/** True when the request looks automated: hidden field filled, or sent faster than a person can type. */
export function looksLikeBot(body) {
  const elapsed = Number(body.elapsed_ms);
  return (typeof body.website === 'string' && body.website.trim() !== '') || !Number.isFinite(elapsed) || elapsed < MIN_FILL_MS;
}

export function clientIp(req) {
  return String(req.headers['x-real-ip'] || req.headers['x-forwarded-for'] || '').split(',')[0].trim() || 'unknown';
}

export function ipHash(req, salt) {
  return createHash('sha256').update(`${salt}:${clientIp(req)}`).digest('hex');
}

// Best-effort per-instance limit (the database limit applies too when Supabase is configured).
const hits = new Map();
export function overLimit(key, max = 5, windowMs = 60 * 60 * 1000) {
  const now = Date.now();
  const list = (hits.get(key) || []).filter((t) => now - t < windowMs);
  list.push(now);
  hits.set(key, list);
  if (hits.size > 5000) hits.clear();
  return list.length > max;
}

export function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function clean(v, max) {
  return typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').trim().slice(0, max) : '';
}

/** Small Resend client over fetch. Throws on non-2xx with the status attached (never the payload). */
export async function resend(path, { method = 'GET', body } = {}) {
  const key = process.env.RESEND_API_KEY;
  if (!key) { const e = new Error('RESEND_API_KEY missing'); e.status = 0; throw e; }
  const r = await fetch(`https://api.resend.com${path}`, {
    method,
    headers: { authorization: `Bearer ${key}`, 'content-type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await r.text();
  let json = null;
  try { json = text ? JSON.parse(text) : null; } catch { /* ignore */ }
  if (!r.ok) { const e = new Error(`resend ${method} ${path.split('/')[1]} ${r.status}`); e.status = r.status; e.detail = json; throw e; }
  return json;
}

export const FROM = 'Doorstep <tickets@doorsteptickets.com>';
export const REPLY_TO = 'support@doorsteptickets.com';
