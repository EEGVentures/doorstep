// Confirmation email for a first-access sign-up. Light-first, brand palette, no barcodes, no prices.
const SITE = (process.env.SITE_URL || 'https://doorsteptickets.com').replace(/\/$/, '');

export function confirmationEmail({ marketing }) {
  const subject = 'You’re on the list for Doorstep';
  const extra = marketing
    ? 'You also asked for occasional emails about good nights out near you. Every one has an unsubscribe link.'
    : 'Until then, this is the only email we’ll send you.';
  const text = [
    'You’re on the list.',
    '',
    'Thanks for signing up for first access to Doorstep: gigs, comedy and theatre at venues near you, in one easy app.',
    'We open in February 2027, and we’ll email you as soon as accounts open.',
    extra,
    '',
    'Not you? Reply to this email and we’ll take you off the list.',
    '',
    'The Doorstep crew',
    'Good nights out, on your Doorstep.',
    `${SITE}/privacy`,
  ].join('\n');

  const html = `<!doctype html>
<html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="color-scheme" content="light only"><title>${subject}</title></head>
<body style="margin:0;padding:0;background:#fcfaf8;">
<div style="display:none;max-height:0;overflow:hidden;">We’ll email you as soon as accounts open in February 2027.</div>
<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#fcfaf8;">
<tr><td align="center" style="padding:32px 16px;">
  <table role="presentation" width="600" cellpadding="0" cellspacing="0" style="width:100%;max-width:600px;">
    <tr><td style="padding:0 4px 20px;">
      <img src="${SITE}/assets/img/doorstep-lockup-c-light.png" width="148" alt="Doorstep" style="display:block;width:148px;height:auto;border:0;">
    </td></tr>
    <tr><td style="background:#ffffff;border:1px solid #efe9e6;border-radius:28px;padding:36px 32px;box-shadow:0 18px 40px -22px rgba(26,16,48,0.22);">
      <h1 style="margin:0 0 16px;font-family:Poppins,Arial,sans-serif;font-weight:700;font-size:32px;line-height:1.15;letter-spacing:-0.5px;color:#1a1030;">You’re on the&nbsp;<span style="border-bottom:4px solid #ff5a5f;">list.</span></h1>
      <p style="margin:0 0 14px;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1030;">Thanks for signing up for first access to Doorstep: gigs, comedy and theatre at venues near you, in one easy app.</p>
      <p style="margin:0 0 14px;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:#1a1030;">We open in <strong>February 2027</strong>, and we’ll email you as soon as accounts open.</p>
      <p style="margin:0 0 24px;font-family:Inter,Arial,sans-serif;font-size:16px;line-height:1.55;color:#655e6b;">${extra}</p>
      <table role="presentation" cellpadding="0" cellspacing="0"><tr>
        <td style="padding-right:12px;vertical-align:middle;"><img src="${SITE}/assets/img/doorstep-emblem-v4-gradient.png" width="36" height="37" alt="" style="display:block;border:0;"></td>
        <td style="vertical-align:middle;font-family:Poppins,Arial,sans-serif;font-weight:600;font-size:16px;color:#1a1030;">The Doorstep crew</td>
      </tr></table>
    </td></tr>
    <tr><td style="padding:24px 8px 0;font-family:Inter,Arial,sans-serif;font-size:13px;line-height:1.5;color:#655e6b;">
      <p style="margin:0 0 6px;font-family:Poppins,Arial,sans-serif;font-weight:600;font-size:15px;color:#1a1030;">Good nights out, <span style="border-bottom:3px solid #ff5a5f;">on your Doorstep.</span></p>
      <p style="margin:0;">Not you? Reply to this email and we’ll take you off the list. <a href="${SITE}/privacy" style="color:#1a1030;">Privacy notice</a></p>
    </td></tr>
  </table>
</td></tr></table>
</body></html>`;
  return { subject, html, text };
}
