import { describe, expect, it } from 'vitest';
import { renderEmail, SUBJECTS } from '../../server/email/render.js';
import { TEMPLATES, type TemplateId } from '../../server/email/templates.generated.js';

const brand = {
  site_url: 'https://doorsteptickets.com', asset_base: 'https://doorsteptickets.com/email-assets', logo_url: 'https://doorsteptickets.com/email-assets/doorstep-lockup-c-light.png',
  company_legal_name: 'Doorstep Ltd', company_number: '00000000', company_address: '1 Test St, Cardiff',
};

const placeholders = (s: string) => [...s.matchAll(/\{\{([a-z0-9_]+)\}\}/g)].map((m) => m[1]);

describe('customer email templates', () => {
  for (const id of Object.keys(TEMPLATES) as TemplateId[]) {
    it(`${id} renders with every placeholder filled`, () => {
      const keys = new Set([...placeholders(TEMPLATES[id]), ...placeholders(SUBJECTS[id])]);
      const data = Object.fromEntries([...keys].map((k) => [k, k === 'first_name' ? 'Sam <script>' : `v_${k}`]));
      const out = renderEmail(id, data, brand);
      expect(out.html).not.toMatch(/\{\{/);
      expect(out.html).toContain('https://doorsteptickets.com/email-assets/');
      expect(out.html).not.toContain('<script>');
      expect(out.subject).not.toMatch(/\{\{/);
      expect(out.text.length).toBeGreaterThan(100);
    });
  }
  it('refuses to render when a value is missing', () => {
    expect(() => renderEmail('welcome', {}, brand)).toThrow(/missing values/);
  });
  it('never puts a barcode in an email', () => {
    for (const html of Object.values(TEMPLATES)) expect(html).not.toMatch(/\{\{barcode/);
  });
});
