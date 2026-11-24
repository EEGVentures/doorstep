// Last-ticket race: 25 customers try to buy from a ticket type with 5 left, all at once,
// each on its own connection. Exactly 5 holds may succeed.
import pg from 'pg';
const url = process.env.DATABASE_URL;
const admin = new pg.Client({ connectionString: url });
await admin.connect();
const N = 25, CAP = 5;
await admin.query(`
  insert into public.venues (id, slug, name, city) values ('10000000-0000-0000-0000-0000000000cc', 'race-venue', 'Race Venue', 'Cardiff');
  insert into public.events (id, slug, venue_id, title, starts_at, doors_at, status)
    values ('20000000-0000-0000-0000-0000000000cc', 'race', '10000000-0000-0000-0000-0000000000cc', 'Race', now() + interval '10 days', now() + interval '10 days', 'on_sale');
  insert into public.ticket_types (id, event_id, name, price_pence, capacity)
    values ('30000000-0000-0000-0000-0000000000cc', '20000000-0000-0000-0000-0000000000cc', 'GA', 1000, ${CAP});
`);
const users = [];
for (let i = 0; i < N; i++) {
  const { rows } = await admin.query(`insert into auth.users (email) values ($1) returning id`, [`racer${i}@test.local`]);
  users.push(rows[0].id);
}
const clients = await Promise.all(users.map(async () => { const c = new pg.Client({ connectionString: url }); await c.connect(); return c; }));
const results = await Promise.allSettled(clients.map((c, i) =>
  c.query(`select (public.create_reservation($1, '30000000-0000-0000-0000-0000000000cc', 1)).id`, [users[i]])));
const ok = results.filter(r => r.status === 'fulfilled').length;
const soldOut = results.filter(r => r.status === 'rejected' && /DS_SOLD_OUT/.test(r.reason.message)).length;
const other = results.filter(r => r.status === 'rejected' && !/DS_SOLD_OUT/.test(r.reason.message));
const { rows: [tt] } = await admin.query(`select held, sold, capacity from public.ticket_types where id = '30000000-0000-0000-0000-0000000000cc'`);
await Promise.all(clients.map(c => c.end()));
await admin.end();
if (other.length) { console.error(other.map(o => o.reason.message)); process.exit(1); }
if (ok !== CAP || soldOut !== N - CAP || tt.held !== CAP) {
  console.error({ ok, soldOut, tt }); process.exit(1);
}
console.log(`race ok: ${ok} holds, ${soldOut} sold out, held=${tt.held}/${tt.capacity}`);
