import { TEMPLATES, type TemplateId } from './templates.generated.js';

// Subject lines signed off on 4 Nov 2026 (see the customer email journey PDF). Door passes arrive with the
// order since 25 Nov 2026, so tickets-ready became a reminder the day before doors.
export const SUBJECTS: Record<TemplateId, string> = {
  'welcome': 'Welcome to Doorstep, {{first_name}}',
  'order-confirmed': 'You’re going to {{event_name}}',
  'event-reminder': 'See you {{event_day}}: {{event_name}}',
  'event-cancelled': 'You’ve been refunded: {{event_name}} is cancelled',
  'event-changed': 'New {{change_label}} for {{event_name}}',
  'refund-issued': 'You’ve been refunded {{refund_amount}}: {{event_name}}',
};

export type Brand = {
  site_url: string;
  asset_base: string;
  logo_url: string;
  company_legal_name: string;
  company_number: string;
  company_address: string;
};

const escapeHtml = (s: string) =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');

function fill(tpl: string, vars: Record<string, string>, escape: boolean, assetBase: string) {
  const missing = new Set<string>();
  const out = tpl
    .replace(/\{\{asset_base\/([^}]+)\}\}/g, (_m, file: string) => `${assetBase.replace(/\/$/, '')}/${file}`)
    .replace(/\{\{([a-z0-9_]+)\}\}/g, (_m, key: string) => {
      const v = vars[key];
      if (v === undefined || v === null) {
        missing.add(key);
        return '';
      }
      return escape ? escapeHtml(String(v)) : String(v);
    });
  if (missing.size) throw new Error(`Email is missing values: ${[...missing].join(', ')}`);
  return out;
}

export function isTemplate(id: string): id is TemplateId {
  return id in TEMPLATES;
}

/** Renders a template. Throws if any placeholder has no value, so a half-filled email is never sent. */
export function renderEmail(id: TemplateId, data: Record<string, string>, brand: Brand) {
  const vars = { ...data, ...brand } as Record<string, string>;
  const html = fill(TEMPLATES[id], vars, true, brand.asset_base);
  const subject = fill(SUBJECTS[id], vars, false, brand.asset_base);
  return { subject, html, text: htmlToText(html) };
}

export function htmlToText(html: string) {
  return html
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<div style="display:none[\s\S]*?<\/div>/i, '')
    .replace(/<a [^>]*href="([^"]+)"[^>]*>([\s\S]*?)<\/a>/gi, (_m, href, label) => `${label.replace(/<[^>]+>/g, '').trim()} (${href})`)
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/(p|h1|h2|h3|tr|div)>/gi, '\n')
    .replace(/<[^>]+>/g, '')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&#39;|&rsquo;/g, '’')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n\s*\n\s*\n+/g, '\n\n')
    .trim();
}
