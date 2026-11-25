// POST /api/signup: "first access" sign-up.
// Resend (required): the person becomes a Resend contact in the segment "First access"; if they ticked the
// marketing box they are also added to "News opt-in". New contacts get one confirmation email from tickets@.
// Supabase (optional, when SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY are set): also records consent wording and
// time in public.launch_signups, with the database's per-IP limit.
// Env: RESEND_API_KEY (full access, server only, never VITE_), optional HOLDING_IP_SALT, HOLDING_PREVIEW=1 for a demo,
// optional COMPANY_LEGAL_NAME, COMPANY_NUMBER, COMPANY_ADDRESS for the email footer.
// Bot protection: same-origin check, honeypot, minimum fill time, per-IP hourly limit. Never logs email addresses.
import { isPreview, send, sameOrigin, readBody, looksLikeBot, ipHash, overLimit, clean, resend, EMAIL_RE, FROM, REPLY_TO } from './_lib.js';
import { confirmationEmail } from './_email.js';

const SEGMENT_ALL = 'First access';
const SEGMENT_NEWS = 'News opt-in';
let segmentIds = null;

async function segments() {
  if (segmentIds) return segmentIds;
  const list = await resend('/segments');
  const byName = new Map((list?.data || []).map((s) => [s.name, s.id]));
  for (const name of [SEGMENT_ALL, SEGMENT_NEWS]) {
    if (!byName.has(name)) {
      const created = await resend('/segments', { method: 'POST', body: { name } });
      byName.set(name, created.id);
    }
  }
  segmentIds = { all: byName.get(SEGMENT_ALL), news: byName.get(SEGMENT_NEWS) };
  return segmentIds;
}

async function existingContact(email) {
  try {
    return await resend(`/contacts/${encodeURIComponent(email)}`);
  } catch (e) {
    if (e.status === 404) return null;
    throw e;
  }
}

async function recordInSupabase({ email, marketing, consentText, source, hash }) {
  const url = process.env.SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) return 'skipped';
  const headers = { 'content-type': 'application/json', apikey: key };
  if (!key.startsWith('sb_')) headers.authorization = `Bearer ${key}`;
  const r = await fetch(`${url.replace(/\/$/, '')}/rest/v1/rpc/register_launch_interest`, {
    method: 'POST',
    headers,
    body: JSON.stringify({ p_email: email, p_marketing: marketing, p_consent_text: consentText, p_source: source, p_ip_hash: hash }),
  });
  if (r.ok) return 'ok';
  const text = await r.text();
  if (text.includes('DS_RATE_LIMITED')) return 'rate_limited';
  if (text.includes('DS_BAD_EMAIL')) return 'bad_email';
  console.error('signup: database error', r.status, text.replace(/[^\s@]+@[^\s@]+/g, '[email]').slice(0, 300));
  return 'error';
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
  if (looksLikeBot(body)) return send(res, 200, { ok: true }); // tell bots nothing

  const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : '';
  if (!EMAIL_RE.test(email) || email.length > 254) return send(res, 400, { error: 'bad_email' });
  const marketing = body.marketing === true;
  const consentText = marketing ? clean(body.consent_text, 500) : null;
  if (marketing && !consentText) return send(res, 400, { error: 'bad_request' });
  const source = typeof body.source === 'string' ? body.source.replace(/[^\w.-]/g, '').slice(0, 64) || null : null;

  if (isPreview(req)) return send(res, 200, { ok: true, preview: true });

  const salt = process.env.HOLDING_IP_SALT || process.env.RESEND_API_KEY || 'doorstep';
  const hash = ipHash(req, salt);
  if (overLimit(`signup:${hash}`)) return send(res, 429, { error: 'rate_limited' });

  if (!process.env.RESEND_API_KEY) {
    console.error('signup: RESEND_API_KEY missing');
    return send(res, 503, { error: 'unavailable' });
  }

  try {
    const db = await recordInSupabase({ email, marketing, consentText, source, hash });
    if (db === 'rate_limited') return send(res, 429, { error: 'rate_limited' });
    if (db === 'bad_email') return send(res, 400, { error: 'bad_email' });

    const seg = await segments();
    const found = await existingContact(email);
    if (!found) {
      const segs = [{ id: seg.all }];
      if (marketing) segs.push({ id: seg.news });
      await resend('/contacts', { method: 'POST', body: { email, unsubscribed: false, segments: segs } });
      const mail = confirmationEmail({ marketing });
      await resend('/emails', {
        method: 'POST',
        body: { from: FROM, to: [email], reply_to: REPLY_TO, subject: mail.subject, html: mail.html, text: mail.text },
      });
    } else {
      // Already on the list: no second email. Add to the segments they asked for; never remove anything.
      const add = [seg.all, ...(marketing ? [seg.news] : [])];
      for (const id of add) {
        try { await resend(`/contacts/${encodeURIComponent(found.id)}/segments/${id}`, { method: 'POST' }); } catch (e) {
          if (e.status !== 409 && e.status !== 422) console.error('signup: segment add failed', e.status);
        }
      }
      if (marketing && found.unsubscribed) {
        await resend(`/contacts/${encodeURIComponent(found.id)}`, { method: 'PATCH', body: { unsubscribed: false } });
      }
    }
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('signup: failed', e && e.message);
    return send(res, 502, { error: 'unavailable' });
  }
}
