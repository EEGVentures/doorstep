/**
 * Clickable preview build (`npm run build:demo`). Not used in production: everything here is behind VITE_DEMO.
 * Answers the app's Supabase and /api calls from sample data so the UI can be tried without a backend.
 * Payments are always refused. Must be the first import in main.tsx so fetch is patched before Supabase loads.
 */
export const DEMO = import.meta.env.VITE_DEMO === '1';

const store = {
  get(k: string) { try { return localStorage.getItem(k); } catch { return null; } },
  set(k: string, v: string | null) { try { v == null ? localStorage.removeItem(k) : localStorage.setItem(k, v); } catch { /* private mode */ } },
};
export const demoRole = (): 'guest' | 'member' => (store.get('ds_demo_role') === 'member' ? 'member' : 'guest');
export const setDemoRole = (r: 'guest' | 'member') => { store.set('ds_demo_role', r); location.reload(); };

export function demoSession(): any {
  if (!DEMO || demoRole() !== 'member') return null;
  return { access_token: 'demo', token_type: 'bearer', expires_in: 3600, refresh_token: 'demo',
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'preview@doorstep.live', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } };
}

const day = 86400e3;
const base = new Date(); base.setHours(12, 0, 0, 0);
const at = (d: number, h: number) => new Date(base.getTime() + d * day + (h - 12) * 3600e3).toISOString();
const rows: [string, string | null, string, string, string, number][] = [
  ['Crowd Pleasers Live', 'music.jpg', 'Tramshed', 'Cardiff', 'Gig', 3],
  ['Late Laughs Comedy', 'comedy.jpg', 'The Gate', 'Cardiff', 'Comedy', 4],
  ['Blue Note Evenings', 'jazz.jpg', 'Tramshed', 'Bristol', 'Jazz', 5],
  ['The Glass Menagerie', 'theatre.jpg', 'The Gate', 'Cardiff', 'Theatre', 6],
  ['Neighbourhood Session', null, 'Tramshed', 'Bristol', 'Gig', 7],
  ['Friday Floorfillers', 'neighbourhood.jpg', 'The Gate', 'Cardiff', 'Club night', 8],
  ['Open Mic Comedy', 'comedy.jpg', 'Tramshed', 'Bristol', 'Comedy', 9],
];
const listings = rows.map(([title, img, venue, city, category, d], i) => ({
  id: `e${i}`, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, image_url: img ? `demo/${img}` : null, category,
  starts_at: at(d, 20), doors_at: at(d, 19), status: i === 3 ? 'sold_out' : 'on_sale', venue_name: venue, venue_city: city,
  timezone: 'Europe/London', from_price_pence: 1410 + i * 100, tickets_left: i === 3 ? 0 : 40,
}));
const eventFor = (slug: string) => {
  const l = listings.find((x) => x.slug === slug) ?? listings[0];
  const i = listings.indexOf(l);
  return { id: l.id, slug: l.slug, title: l.title, image_url: l.image_url, starts_at: l.starts_at, doors_at: l.doors_at, status: l.status,
    description: `${l.category} night at ${l.venue_name}, ${l.venue_city}. Sample event for the preview: real listings come from the venue import.`,
    venue: { name: l.venue_name, city: l.venue_city, address_line: l.venue_name === 'Tramshed' ? 'Clive St, Grangetown' : '1 Gate Lane', postcode: 'CF11 7EN', timezone: 'Europe/London' },
    ticket_types: [
      { id: `${l.id}-ga`, name: 'General admission', price_pence: 1260 + i * 100, fee_pence: 150, face_value_pence: 2100 + i * 100, capacity: 50, sold: i === 3 ? 50 : 10, held: 0, max_per_order: 6, sort_order: 0 },
      { id: `${l.id}-vip`, name: 'Front row', price_pence: 2400 + i * 100, fee_pence: 200, face_value_pence: 3500, capacity: 10, sold: 10, held: 0, max_per_order: 4, sort_order: 1 },
    ] };
};

const json = (body: unknown, status = 200, wait = 350) =>
  new Promise<Response>((r) => setTimeout(() => r(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })), wait));

if (DEMO) {
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const p = url.pathname;
    if (p.includes('/rest/v1/event_listings')) return json(listings, 200, 700);
    if (p.includes('/rest/v1/events')) return json(eventFor(decodeURIComponent((url.searchParams.get('slug') ?? '').replace(/^eq\./, ''))), 200, 300);
    if (p.includes('/rest/v1/rpc/has_active_membership')) return json(demoRole() === 'member');
    if (p.includes('/rest/v1/profiles')) return json({ id: demoSession()?.user.id, email: 'preview@doorstep.live', first_name: 'Preview', last_name: 'Member', role: 'customer', marketing_email_consent: true });
    if (p.includes('/rest/v1/')) return json([]);
    if (p.includes('/auth/v1/')) return json({ error: 'demo' }, 400);
    if (p.endsWith('/api/checkout')) return json({ error: { code: 'DEMO', message: 'This is a preview, so payments are switched off. In the real app this is where Stripe checkout opens.' } }, 409, 1400);
    if (p.includes('/api/')) return json({ error: { code: 'DEMO', message: 'Not available in the preview.' } }, 409);
    return real(input as RequestInfo, init);
  };
}
