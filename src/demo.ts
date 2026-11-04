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
const venues: Record<string, { city: string; address: string; postcode: string; lat: number; lng: number }> = {
  'Tramshed': { city: 'Cardiff', address: 'Clive St, Grangetown', postcode: 'CF11 7EN', lat: 51.4706, lng: -3.1937 },
  'The Gate': { city: 'Cardiff', address: 'Keppoch St, Roath', postcode: 'CF24 3JW', lat: 51.4925, lng: -3.1636 },
  'The Fleece': { city: 'Bristol', address: '12 St Thomas St', postcode: 'BS1 6JJ', lat: 51.4527, lng: -2.5862 },
  'Thekla': { city: 'Bristol', address: 'The Grove', postcode: 'BS1 4RB', lat: 51.4483, lng: -2.5953 },
};
const rows: [string, string | null, string, string, number, number][] = [
  ['Quiz & Tunes', null, 'The Gate', 'Quiz night', 0, 19],
  ['Crowd Pleasers Live', 'music.jpg', 'Tramshed', 'Gig', 3, 20],
  ['Late Laughs Comedy', 'comedy.jpg', 'The Gate', 'Comedy', 4, 20],
  ['Blue Note Evenings', 'jazz.jpg', 'The Fleece', 'Jazz', 5, 20],
  ['The Glass Menagerie', 'theatre.jpg', 'The Gate', 'Theatre', 6, 19],
  ['Neighbourhood Session', null, 'Thekla', 'Gig', 7, 20],
  ['Friday Floorfillers', 'neighbourhood.jpg', 'Tramshed', 'Club night', 9, 22],
  ['Open Mic Comedy', 'comedy.jpg', 'The Fleece', 'Comedy', 10, 20],
];
const listings = rows.map(([title, img, venue, category, d, h], i) => {
  const v = venues[venue];
  return {
    id: `e${i}`, slug: title.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, image_url: img ? `demo/${img}` : null, category,
    starts_at: at(d, h), doors_at: at(d, h - 1), status: title === 'The Glass Menagerie' ? 'sold_out' : 'on_sale', venue_name: venue, venue_city: v.city,
    timezone: 'Europe/London', from_price_pence: 1410 + i * 100, tickets_left: title === 'The Glass Menagerie' ? 0 : 40, venue_lat: v.lat, venue_lng: v.lng,
    house_favourite: title === 'Crowd Pleasers Live' || title === 'Blue Note Evenings',
  };
});
const eventFor = (slug: string) => {
  const l = listings.find((x) => x.slug === slug) ?? listings[1];
  const i = listings.indexOf(l), v = venues[l.venue_name], sold = l.status === 'sold_out';
  return { id: l.id, slug: l.slug, title: l.title, image_url: l.image_url, starts_at: l.starts_at, doors_at: l.doors_at, status: l.status,
    description: `${l.category} at ${l.venue_name}, ${l.venue_city}. This is a sample night for the preview; real listings come from venues.`,
    venue: { name: l.venue_name, city: v.city, address_line: v.address, postcode: v.postcode, timezone: 'Europe/London', lat: v.lat, lng: v.lng },
    ticket_types: [
      { id: `${l.id}-ga`, name: 'General admission', price_pence: 1260 + i * 100, fee_pence: 150, face_value_pence: 2100 + i * 100, capacity: 50, sold: sold ? 50 : 10, held: 0, max_per_order: 6, sort_order: 0 },
      { id: `${l.id}-vip`, name: 'Front row', price_pence: 2400 + i * 100, fee_pence: 200, face_value_pence: 3500, capacity: 10, sold: 10, held: 0, max_per_order: 4, sort_order: 1 },
    ] };
};
const outcodes: Record<string, [number, number, string]> = {
  CF10: [51.4787, -3.1772, 'Cardiff'], CF11: [51.4747, -3.198, 'Cardiff'], CF14: [51.523, -3.201, 'Cardiff'], CF24: [51.488, -3.16, 'Cardiff'],
  CF5: [51.483, -3.235, 'Cardiff'], BS1: [51.453, -2.593, 'Bristol'], BS3: [51.438, -2.6, 'Bristol'], BS6: [51.472, -2.6, 'Bristol'], NP20: [51.587, -3.0, 'Newport'],
};
// Two passes for the member's wallet: one inside the 48h window (code showing), one still counting down.
const ticket = (l: typeof listings[number], barcode: string | null, ref: string) => ({
  id: `t-${l.id}`, status: 'valid', order_ref: ref, ticket_type: 'General admission', event_title: l.title, event_slug: l.slug, image_url: l.image_url,
  starts_at: l.starts_at, doors_at: l.doors_at, reveal_at: new Date(new Date(l.doors_at).getTime() - 48 * 3600e3).toISOString(),
  venue_name: l.venue_name, venue_city: l.venue_city, timezone: 'Europe/London', holder_first_name: 'Preview', holder_last_name: 'Member', barcode,
});
const myTickets = [ticket(listings[0], 'DS7K2M9QXH4P', 'DS-4F7Q2'), ticket(listings[2], null, 'DS-9C3KD')];

const json = (body: unknown, status = 200, wait = 350) =>
  new Promise<Response>((r) => setTimeout(() => r(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })), wait));

if (DEMO) {
  // The preview can't read a real location (the hosted page blocks it), so "Use my location" pretends you're in Grangetown, Cardiff.
  try {
    Object.defineProperty(navigator, 'geolocation', { configurable: true, value: {
      getCurrentPosition: (ok: PositionCallback) => setTimeout(() => ok({ coords: { latitude: 51.4747, longitude: -3.198, accuracy: 900 }, timestamp: Date.now() } as GeolocationPosition), 700),
      watchPosition: () => 0, clearWatch: () => {},
    } });
  } catch { /* leave the real one */ }
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const p = url.pathname;
    if (p.includes('/rest/v1/event_listings')) return json(listings, 200, 700);
    if (p.includes('/rest/v1/events')) return json(eventFor(decodeURIComponent((url.searchParams.get('slug') ?? '').replace(/^eq\./, ''))), 200, 300);
    if (p.includes('/rest/v1/rpc/has_active_membership')) return json(demoRole() === 'member');
    if (url.hostname === 'api.postcodes.io' && url.searchParams.has('lat')) {
      const la = Number(url.searchParams.get('lat')), lo = Number(url.searchParams.get('lon'));
      const [code, o] = Object.entries(outcodes).sort(([, a], [, b]) => Math.hypot(a[0] - la, a[1] - lo) - Math.hypot(b[0] - la, b[1] - lo))[0];
      return json({ status: 200, result: [{ outcode: code, latitude: o[0], longitude: o[1], admin_district: [o[2]] }] }, 200, 300);
    }
    if (url.hostname === 'api.postcodes.io') {
      const code = decodeURIComponent(p.split('/').pop() ?? '').toUpperCase();
      const o = outcodes[code];
      return o ? json({ status: 200, result: { outcode: code, latitude: o[0], longitude: o[1], admin_district: [o[2]] } }) : json({ status: 404, error: 'Outcode not found' }, 404);
    }
    if (p.includes('/rest/v1/my_tickets')) return json(demoRole() === 'member' ? myTickets : []);
    if (p.includes('/rest/v1/profiles')) return json({ id: demoSession()?.user.id, email: 'preview@doorstep.live', first_name: 'Preview', last_name: 'Member', role: 'customer', marketing_email_consent: true });
    if (p.includes('/rest/v1/')) return json([]);
    if (p.includes('/auth/v1/')) return json({ error: 'demo' }, 400);
    if (p.endsWith('/api/checkout')) return json({ error: { code: 'DEMO', message: 'This is a preview, so payments are switched off. In the real app this is where Stripe checkout opens.' } }, 409, 1400);
    if (p.includes('/api/')) return json({ error: { code: 'DEMO', message: 'Not available in the preview.' } }, 409);
    return real(input as RequestInfo, init);
  };
}
