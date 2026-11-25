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
/** Price-visibility option under review: 'signed_in' (default, matches the database) or 'everyone'. */
export const demoPrices = (): 'everyone' | 'signed_in' => (store.get('ds_demo_prices') === 'everyone' ? 'everyone' : 'signed_in');
export const setDemoPrices = (v: 'everyone' | 'signed_in') => { store.set('ds_demo_prices', v); location.reload(); };
const guestBlind = () => demoRole() === 'guest' && demoPrices() === 'signed_in';

export function demoSession(): any {
  if (!DEMO || demoRole() !== 'member') return null;
  return { access_token: 'demo', token_type: 'bearer', expires_in: 3600, refresh_token: 'demo',
    user: { id: '00000000-0000-4000-8000-000000000001', email: 'preview@doorsteptickets.com', app_metadata: {}, user_metadata: {}, aud: 'authenticated', created_at: '' } };
}

const venues: Record<string, { city: string; address: string; postcode: string; lat: number; lng: number }> = {
  "O2 Shepherd's Bush Empire": { city: 'London', address: "Shepherd's Bush Green", postcode: 'W12 8TT', lat: 51.5035, lng: -0.2244 },
  'Cambridge Theatre': { city: 'London', address: 'Earlham St', postcode: 'WC2H 9HU', lat: 51.5136, lng: -0.1268 },
  'Tramshed': { city: 'Cardiff', address: 'Clive St, Grangetown', postcode: 'CF11 7EN', lat: 51.4706, lng: -3.1937 },
  'The Forum': { city: 'Bath', address: '20 Southgate St', postcode: 'BA1 1TP', lat: 51.3784, lng: -2.3591 },
  'Connexin Live': { city: 'Hull', address: 'Myton St', postcode: 'HU1 2PS', lat: 53.7406, lng: -0.3365 },
  'The Prospect Building': { city: 'Bristol', address: 'Temple Quarter', postcode: 'BS1 6QF', lat: 51.45, lng: -2.581 },
};
// Ernest Promotions' own upcoming shows (Master Tickets sheet), with their real artwork. Dates are real, not relative.
const on = (d: string, h: number, m = 0) => new Date(`${d}T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00Z`).toISOString();
const rows: [string, string | null, string, string, string, string | null][] = [
  ['East 17: Boys Are Back Again', 'east17-tour.jpg', "O2 Shepherd's Bush Empire", 'Music', on('2026-12-03', 19, 30), 'selling_fast'],
  ['East 17: Boys Are Back Again', 'east17-tour.jpg', 'Tramshed', 'Music', on('2026-12-02', 20), null],
  ['Snow White On Ice', 'snow-white.jpg', 'Connexin Live', 'Family', on('2026-12-18', 19), 'new'],
  ['Peter Pan On Ice', 'peter-pan-bath.jpg', 'The Forum', 'Family', on('2026-12-27', 14), 'last_few'],
  ['Aswad: Roots & Soul', 'aswad-bristol.jpg', 'The Prospect Building', 'Music', on('2027-05-09', 18), 'new'],
  ['Sydnie Christmas: The Artist Tour', 'sydnie-christmas.jpg', 'Cambridge Theatre', 'Music', on('2027-05-17', 18, 30), 'selling_fast'],
];
const listings = rows.map(([title, img, venue, category, starts, flag], i) => {
  const v = venues[venue];
  return {
    id: `e${i}`, slug: `${title}-${v.city}`.toLowerCase().replace(/[^a-z0-9]+/g, '-'), title, image_url: img ? `sample/ep/${img}` : null, category,
    starts_at: starts, doors_at: new Date(new Date(starts).getTime() - 3600e3).toISOString(), status: venue === 'Tramshed' ? 'sold_out' : 'on_sale', venue_name: venue, venue_city: v.city,
    timezone: 'Europe/London', from_price_pence: 1410 + i * 100, tickets_left: venue === 'Tramshed' ? 0 : 40, venue_lat: v.lat, venue_lng: v.lng,
    flag,
  };
});
const eventFor = (slug: string) => {
  const l = listings.find((x) => x.slug === slug) ?? listings[1];
  const i = listings.indexOf(l), v = venues[l.venue_name], sold = l.status === 'sold_out';
  return { id: l.id, slug: l.slug, title: l.title, category: l.category, flag: l.flag, image_url: l.image_url, starts_at: l.starts_at, doors_at: l.doors_at, status: l.status,
    description: `${l.category} at ${l.venue_name}, ${l.venue_city}. Sample listing for the preview, built from a real Ernest Promotions show.`,
    venue: { name: l.venue_name, city: v.city, address_line: v.address, postcode: v.postcode, timezone: 'Europe/London', lat: v.lat, lng: v.lng },
    ticket_types: [
      { id: `${l.id}-ga`, name: 'General admission', price_pence: 1260 + i * 100, fee_pence: 150, face_value_pence: 2100 + i * 100, capacity: 50, sold: sold ? 50 : 10, held: 0, max_per_order: 6, sort_order: 0 },
      { id: `${l.id}-vip`, name: 'Front row', price_pence: 2400 + i * 100, fee_pence: 200, face_value_pence: 3500, capacity: 10, sold: 10, held: 0, max_per_order: 4, sort_order: 1 },
    ] };
};
// Two passes for the member's wallet. Codes show from purchase (25 Nov 2026).
const ticket = (l: typeof listings[number], barcode: string | null, ref: string) => ({
  id: `t-${l.id}`, status: 'valid', order_ref: ref, ticket_type: 'General admission', event_title: l.title, event_slug: l.slug, image_url: l.image_url,
  starts_at: l.starts_at, doors_at: l.doors_at, reveal_at: new Date().toISOString(),
  venue_name: l.venue_name, venue_city: l.venue_city, timezone: 'Europe/London', holder_first_name: 'Preview', holder_last_name: 'Member', barcode,
});
const baseTickets = [ticket(listings[0], 'DS7K2M9QXH4P', 'DS-4F7Q2'), ticket(listings[2], 'DS9C3KDW7TNR', 'DS-9C3KD')];
/** Video walkthrough only (localStorage ds_demo_checkout=1): a mock checkout page, then the bought passes land a moment after "payment". */
const myTickets = () => {
  let bought: { slug: string; qty: number; ref: string; at: number } | null = null;
  try { bought = JSON.parse(store.get('ds_demo_bought') ?? 'null'); } catch { /* ignore */ }
  if (!bought || !bought.at) return baseTickets;
  const l = listings.find((x) => x.slug === bought!.slug) ?? listings[1];
  const fresh = Array.from({ length: bought.qty }, (_, k) => ({ ...ticket(l, `DSDEMO${String(k).padStart(2, '0')}PASS`, bought!.ref), id: `t-new-${k}` }));
  return [...fresh, ...baseTickets].sort((a, b) => a.starts_at.localeCompare(b.starts_at));
};

const json = (body: unknown, status = 200, wait = 350) =>
  new Promise<Response>((r) => setTimeout(() => r(new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } })), wait));

if (DEMO) {
  const real = window.fetch.bind(window);
  window.fetch = (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(typeof input === 'string' ? input : input instanceof URL ? input.href : input.url, location.href);
    const p = url.pathname;
    if (p.includes('/rest/v1/event_listings') && url.searchParams.get('slug')) {
      const l = listings.find((x) => `eq.${x.slug}` === url.searchParams.get('slug'));
      return json(l ? [{ flag: l.flag }] : [], 200, 200);
    }
    if (p.includes('/rest/v1/event_listings')) return json(guestBlind() ? listings.map((l) => ({ ...l, from_price_pence: null })) : listings, 200, 700);
    if (p.includes('/rest/v1/events')) {
      const ev = eventFor(decodeURIComponent((url.searchParams.get('slug') ?? '').replace(/^eq\./, '')));
      return json(guestBlind() ? { ...ev, ticket_types: ev.ticket_types.map(({ price_pence, fee_pence, face_value_pence, ...t }) => t) } : ev, 200, 300);
    }
    if (p.endsWith('/api/geo')) return json({ city: 'London', country: 'GB', lat: 51.51, lng: -0.13 }, 200, 250);
    if (p.includes('/rest/v1/my_tickets')) return json(demoRole() === 'member' ? myTickets() : []);
    if (p.includes('/rest/v1/profiles')) return json({ id: demoSession()?.user.id, email: 'preview@doorsteptickets.com', first_name: 'Preview', last_name: 'Member', role: 'customer', marketing_email_consent: true });
    if (p.includes('/rest/v1/')) return json([]);
    if (p.includes('/auth/v1/')) return json({ error: 'demo' }, 400);
    if (p.endsWith('/api/checkout') && store.get('ds_demo_checkout') === '1') {
      const b = JSON.parse(String(init?.body ?? '{}')), l = listings.find((x) => b.ticketTypeId?.startsWith(x.id + '-')) ?? listings[1];
      const tt = eventFor(l.slug).ticket_types.find((t) => t.id === b.ticketTypeId)!, qty = b.quantity ?? 1, ref = 'DS-7H2QK';
      store.set('ds_demo_bought', JSON.stringify({ slug: l.slug, qty, ref, at: 0 }));
      const q = new URLSearchParams({ t: l.title, v: `${l.venue_name}, ${l.venue_city}`, img: l.image_url ?? '', when: l.starts_at, qty: String(qty), tt: tt.name, each: String(tt.price_pence + tt.fee_pence), ref });
      return json({ url: `demo/checkout.html?${q}` }, 200, 900);
    }
    if (p.endsWith('/api/checkout')) return json({ error: { code: 'DEMO', message: 'This is a preview, so payments are switched off. In the real app this is where Stripe checkout opens.' } }, 409, 1400);
    if (p.includes('/api/')) return json({ error: { code: 'DEMO', message: 'Not available in the preview.' } }, 409);
    return real(input as RequestInfo, init);
  };
}
