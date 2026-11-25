import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS Vercel functions with no type declarations
import signup from '../../holding/api/signup.js';
// @ts-expect-error plain JS Vercel functions with no type declarations
import partner from '../../holding/api/partner.js';

type Res = { statusCode: number; body: string; headers: Record<string, string>; setHeader(k: string, v: string): void; status(c: number): Res; send(b: string): Res };
function mkRes(): Res {
  const r: Res = {
    statusCode: 0, body: '', headers: {},
    setHeader(k, v) { r.headers[k] = v; },
    status(c) { r.statusCode = c; return r; },
    send(b) { r.body = b; return r; },
  };
  return r;
}
let ipCounter = 0;
const req = (body: unknown, extra: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { host: 'doorsteptickets.com', origin: 'https://doorsteptickets.com', 'x-forwarded-for': `203.0.113.${++ipCounter}`, ...extra },
  body,
});
const good = { email: 'Sam@Example.com', marketing: true, consent_text: 'Also send me occasional emails', website: '', elapsed_ms: 8000 };
const json = (status: number, body: unknown) => new Response(JSON.stringify(body), { status });

// Fake Resend: two segments already exist; contacts in a map.
function fakeResend(existing: string[] = []) {
  const contacts = new Set(existing);
  return vi.fn(async (url: string, init: RequestInit = {}) => {
    const u = new URL(url);
    const method = init.method || 'GET';
    if (u.pathname === '/segments' && method === 'GET') return json(200, { data: [{ id: 'seg_all', name: 'First access' }, { id: 'seg_news', name: 'News opt-in' }] });
    if (u.pathname.startsWith('/contacts/') && method === 'GET') {
      const email = decodeURIComponent(u.pathname.split('/')[2]);
      return contacts.has(email) ? json(200, { id: `c_${email}`, email, unsubscribed: false }) : json(404, { name: 'not_found' });
    }
    if (u.pathname === '/contacts' && method === 'POST') { contacts.add(JSON.parse(String(init.body)).email); return json(200, { id: 'c_new' }); }
    if (u.pathname.includes('/segments/') && method === 'POST') return json(200, {});
    if (u.pathname === '/emails' && method === 'POST') return json(200, { id: 'em_1' });
    return json(500, {});
  });
}
const calls = (f: ReturnType<typeof vi.fn>, path: string, method = 'POST') =>
  f.mock.calls.filter(([u, i]) => new URL(u as string).pathname === path && ((i as RequestInit)?.method || 'GET') === method);

describe('holding page /api/signup (Resend)', () => {
  beforeEach(() => {
    process.env.RESEND_API_KEY = 're_test_key_1234567890';
    delete process.env.SUPABASE_URL;
    delete process.env.HOLDING_PREVIEW;
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('adds a new person to First access + News opt-in and sends one confirmation from tickets@', async () => {
    const f = fakeResend(); vi.stubGlobal('fetch', f);
    const res = mkRes();
    await signup(req(good), res);
    expect(res.statusCode).toBe(200);
    const [, created] = calls(f, '/contacts')[0];
    const body = JSON.parse(String((created as RequestInit).body));
    expect(body.email).toBe('sam@example.com');
    expect(body.segments).toEqual([{ id: 'seg_all' }, { id: 'seg_news' }]);
    const mails = calls(f, '/emails');
    expect(mails).toHaveLength(1);
    const mail = JSON.parse(String((mails[0][1] as RequestInit).body));
    expect(mail.from).toBe('Doorstep <tickets@doorsteptickets.com>');
    expect(mail.to).toEqual(['sam@example.com']);
  });

  it('without the tick, joins First access only', async () => {
    const f = fakeResend(); vi.stubGlobal('fetch', f);
    await signup(req({ ...good, marketing: false, consent_text: null }), mkRes());
    const body = JSON.parse(String((calls(f, '/contacts')[0][1] as RequestInit).body));
    expect(body.segments).toEqual([{ id: 'seg_all' }]);
  });

  it('does not email someone already on the list', async () => {
    const f = fakeResend(['sam@example.com']); vi.stubGlobal('fetch', f);
    const res = mkRes();
    await signup(req(good), res);
    expect(res.statusCode).toBe(200);
    expect(calls(f, '/emails')).toHaveLength(0);
    expect(calls(f, '/contacts')).toHaveLength(0);
  });

  it('quietly drops bots, refuses other sites and bad emails, and honours preview mode', async () => {
    const f = fakeResend(); vi.stubGlobal('fetch', f);
    let res = mkRes(); await signup(req({ ...good, website: 'http://spam' }), res); expect(res.statusCode).toBe(200);
    res = mkRes(); await signup(req({ ...good, elapsed_ms: 300 }), res); expect(res.statusCode).toBe(200);
    res = mkRes(); await signup(req(good, { origin: 'https://evil.example' }), res); expect(res.statusCode).toBe(403);
    res = mkRes(); await signup(req({ ...good, email: 'nope' }), res); expect(res.statusCode).toBe(400);
    process.env.HOLDING_PREVIEW = '1';
    res = mkRes(); await signup(req(good), res); expect(res.statusCode).toBe(200);
    expect(f).not.toHaveBeenCalled();
  });

  it('limits repeat attempts from one address and never logs the email', async () => {
    const f = fakeResend(); vi.stubGlobal('fetch', f);
    const headers = { 'x-forwarded-for': '198.51.100.7' };
    let last = mkRes();
    for (let i = 0; i < 6; i++) { last = mkRes(); await signup(req({ ...good, email: `p${i}@example.com` }, headers), last); }
    expect(last.statusCode).toBe(429);
    vi.stubGlobal('fetch', vi.fn(async () => json(500, { message: 'boom for sam@example.com' })));
    const res = mkRes(); await signup(req(good), res);
    expect(res.statusCode).toBe(502);
    expect(JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls)).not.toContain('sam@example.com');
  });
});

describe('holding page /api/partner', () => {
  beforeEach(() => { process.env.RESEND_API_KEY = 're_test_key_1234567890'; delete process.env.HOLDING_PREVIEW; delete process.env.PARTNERS_TO; });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  const enquiry = { role: 'venue', name: 'Alex <b>', email: 'alex@venue.example', company: 'The Hall', message: 'Hi\nWe have seats.', website: '', elapsed_ms: 9000 };

  it('emails partners@ with reply-to set to the enquirer and escapes their text', async () => {
    const f = fakeResend(); vi.stubGlobal('fetch', f);
    const res = mkRes();
    await partner(req(enquiry), res);
    expect(res.statusCode).toBe(200);
    const mail = JSON.parse(String((calls(f, '/emails')[0][1] as RequestInit).body));
    expect(mail.to).toEqual(['partners@doorsteptickets.com']);
    expect(mail.reply_to).toBe('alex@venue.example');
    expect(mail.subject).toBe('Venue enquiry: The Hall');
    expect(mail.html).toContain('Alex &lt;b&gt;');
  });

  it('needs a name, email and message, and drops bots', async () => {
    const f = fakeResend(); vi.stubGlobal('fetch', f);
    let res = mkRes(); await partner(req({ ...enquiry, message: '' }), res); expect(res.statusCode).toBe(400);
    res = mkRes(); await partner(req({ ...enquiry, website: 'x' }), res); expect(res.statusCode).toBe(200);
    expect(f).not.toHaveBeenCalled();
  });
});

describe('holding page demo hosts', () => {
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });
  it('stores and sends nothing on preview.doorsteptickets.com or vercel.app', async () => {
    process.env.RESEND_API_KEY = 're_test_key_1234567890';
    delete process.env.HOLDING_PREVIEW;
    const f = vi.fn(); vi.stubGlobal('fetch', f);
    for (const host of ['preview.doorsteptickets.com', 'doorstep-holding.vercel.app']) {
      const res = mkRes();
      await signup(req(good, { host, origin: `https://${host}` }), res);
      expect(JSON.parse(res.body)).toEqual({ ok: true, preview: true });
    }
    expect(f).not.toHaveBeenCalled();
  });
});
