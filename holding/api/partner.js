// POST /api/partner: promoter / venue enquiry. Emails the team at PARTNERS_TO (default partners@doorsteptickets.com)
// with reply-to set to the enquirer, so a reply goes straight back to them. No auto-reply (that could be abused
// to send mail to strangers). Env: RESEND_API_KEY, optional PARTNERS_TO, HOLDING_PREVIEW=1 for a demo.
import { isPreview, send, sameOrigin, readBody, looksLikeBot, ipHash, overLimit, clean, escapeHtml, resend, EMAIL_RE } from './_lib.js';

const ROLES = { promoter: 'Event promoter', venue: 'Venue', other: 'Something else' };

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('allow', 'POST');
    return send(res, 405, { error: 'method_not_allowed' });
  }
  if (!sameOrigin(req)) return send(res, 403, { error: 'forbidden' });

  let body;
  try { body = await readBody(req); } catch { return send(res, 400, { error: 'bad_request' }); }
  if (!body || typeof body !== 'object') return send(res, 400, { error: 'bad_request' });
  if (looksLikeBot(body)) return send(res, 200, { ok: true });

  const name = clean(body.name, 120);
  const email = clean(body.email, 254).toLowerCase();
  const company = clean(body.company, 160);
  const role = ROLES[body.role] ? body.role : 'other';
  const message = clean(body.message, 3000);
  if (!name || !EMAIL_RE.test(email) || !message) return send(res, 400, { error: 'missing_fields' });

  if (isPreview(req)) return send(res, 200, { ok: true, preview: true });

  const salt = process.env.HOLDING_IP_SALT || process.env.RESEND_API_KEY || 'doorstep';
  if (overLimit(`partner:${ipHash(req, salt)}`, 3)) return send(res, 429, { error: 'rate_limited' });
  if (!process.env.RESEND_API_KEY) {
    console.error('partner: RESEND_API_KEY missing');
    return send(res, 503, { error: 'unavailable' });
  }

  const to = process.env.PARTNERS_TO || 'partners@doorsteptickets.com';
  const subject = `${ROLES[role]} enquiry: ${company || name}`.slice(0, 150);
  const rows = [['Name', name], ['Email', email], ['Company or venue', company || '(not given)'], ['They are', ROLES[role]]];
  const html = `<div style="font-family:Arial,sans-serif;font-size:15px;line-height:1.5;color:#1a1030">
<p style="margin:0 0 12px">New enquiry from the Doorstep holding page. Reply to this email to answer them directly.</p>
<table cellpadding="6" style="border-collapse:collapse">${rows.map(([k, v]) => `<tr><td style="color:#655e6b">${k}</td><td><strong>${escapeHtml(v)}</strong></td></tr>`).join('')}</table>
<p style="margin:16px 0 4px;color:#655e6b">Message</p>
<p style="margin:0;white-space:pre-wrap">${escapeHtml(message)}</p></div>`;
  const text = `New enquiry from the Doorstep holding page. Reply to answer them directly.\n\n${rows.map(([k, v]) => `${k}: ${v}`).join('\n')}\n\nMessage:\n${message}\n`;

  try {
    await resend('/emails', {
      method: 'POST',
      body: { from: 'Doorstep website <tickets@doorsteptickets.com>', to: [to], reply_to: email, subject, html, text },
    });
    return send(res, 200, { ok: true });
  } catch (e) {
    console.error('partner: failed', e && e.message);
    return send(res, 502, { error: 'unavailable' });
  }
}
