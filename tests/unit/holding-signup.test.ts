import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
// @ts-expect-error plain JS Vercel function with no type declarations
import handler from '../../holding/api/signup.js';

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
const req = (body: unknown, extra: Record<string, string> = {}) => ({
  method: 'POST',
  headers: { host: 'doorsteptickets.com', origin: 'https://doorsteptickets.com', 'x-forwarded-for': '203.0.113.9', ...extra },
  body,
});
const good = { email: 'sam@example.com', marketing: true, consent_text: 'Also send me occasional emails', website: '', elapsed_ms: 8000 };

describe('holding page /api/signup', () => {
  const fetchMock = vi.fn();
  beforeEach(() => {
    process.env.SUPABASE_URL = 'https://example.supabase.co';
    process.env.SUPABASE_SERVICE_ROLE_KEY = 'sb_secret_test_key_1234567890';
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    vi.spyOn(console, 'error').mockImplementation(() => {});
  });
  afterEach(() => { vi.unstubAllGlobals(); vi.restoreAllMocks(); });

  it('stores a valid sign-up through the database function, with a hashed IP only', async () => {
    fetchMock.mockResolvedValue(new Response('"ok"', { status: 200 }));
    const res = mkRes();
    await handler(req(good), res);
    expect(res.statusCode).toBe(200);
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe('https://example.supabase.co/rest/v1/rpc/register_launch_interest');
    const sent = JSON.parse(init.body);
    expect(sent.p_email).toBe('sam@example.com');
    expect(sent.p_marketing).toBe(true);
    expect(sent.p_ip_hash).toMatch(/^[0-9a-f]{64}$/);
    expect(init.body).not.toContain('203.0.113.9');
    expect(init.headers.authorization).toBeUndefined();
  });

  it('quietly drops bots (honeypot or too fast) without touching the database', async () => {
    for (const body of [{ ...good, website: 'http://spam' }, { ...good, elapsed_ms: 300 }]) {
      const res = mkRes();
      await handler(req(body), res);
      expect(res.statusCode).toBe(200);
    }
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('refuses other sites, bad emails, and marketing without wording', async () => {
    let res = mkRes(); await handler(req(good, { origin: 'https://evil.example' }), res); expect(res.statusCode).toBe(403);
    res = mkRes(); await handler(req({ ...good, email: 'nope' }), res); expect(res.statusCode).toBe(400);
    res = mkRes(); await handler(req({ ...good, consent_text: '' }), res); expect(res.statusCode).toBe(400);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('passes the database rate limit back as 429 and never logs the email', async () => {
    fetchMock.mockResolvedValue(new Response('{"message":"DS_RATE_LIMITED"}', { status: 400 }));
    let res = mkRes(); await handler(req(good), res); expect(res.statusCode).toBe(429);
    fetchMock.mockResolvedValue(new Response('{"message":"boom for sam@example.com"}', { status: 500 }));
    res = mkRes(); await handler(req(good), res); expect(res.statusCode).toBe(502);
    const logged = JSON.stringify((console.error as unknown as { mock: { calls: unknown[] } }).mock.calls);
    expect(logged).not.toContain('sam@example.com');
  });
});
