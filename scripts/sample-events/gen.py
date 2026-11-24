# Generates supabase/sample-events.sql from Ernest Promotions' real upcoming shows (Master Tickets sheet, 24 Nov 2026).
import sys
V = {  # key: (name, address, city, postcode, capacity, lat, lng)
 'albert-hall': ('Albert Hall', '27 Peter St', 'Manchester', 'M2 5QR', 2290, 53.4777, -2.2481),
 'uea': ('University of East Anglia (LCR)', 'University Dr', 'Norwich', 'NR4 7TJ', 1500, 52.6219, 1.2392),
 'g-live': ('G Live', 'London Rd', 'Guildford', 'GU1 2AA', 1700, 51.2401, -0.5650),
 'portsmouth-guildhall': ('Portsmouth Guildhall', 'Guildhall Square', 'Portsmouth', 'PO1 2AB', 2500, 50.7968, -1.0921),
 'tramshed': ('Tramshed', 'Clive St, Grangetown', 'Cardiff', 'CF11 7EN', 1000, 51.4706, -3.1937),
 'shepherds-bush-empire': ("O2 Shepherd's Bush Empire", "Shepherd's Bush Green", 'London', 'W12 8TT', 2000, 51.5035, -0.2244),
 'the-halls': ('The Halls Wolverhampton', 'Mitre Fold', 'Wolverhampton', 'WV1 1HQ', 3000, 52.5869, -2.1288),
 'connexin-live': ('Connexin Live', 'Myton St', 'Hull', 'HU1 2PS', 3500, 53.7406, -0.3365),
 'the-forum-bath': ('The Forum', '20 Southgate St', 'Bath', 'BA1 1TP', 1700, 51.3784, -2.3591),
 'theatre-severn': ('Theatre Severn', 'Frankwell Quay', 'Shrewsbury', 'SY3 8FT', 650, 52.7097, -2.7618),
 'o2-academy-leeds': ('O2 Academy Leeds', '55 Cookridge St', 'Leeds', 'LS2 3AW', 2300, 53.8027, -1.5442),
 'prospect-building': ('The Prospect Building', 'Temple Quarter', 'Bristol', 'BS1 6QF', 1800, 51.4500, -2.5810),
 'palace-southend': ('Palace Theatre', '430 London Rd, Westcliff-on-Sea', 'Southend', 'SS0 9LA', 600, 51.5425, 0.6913),
 'the-lowry': ('The Lowry', 'Pier 8, Salford Quays', 'Salford', 'M50 3AZ', 1730, 53.4707, -2.2963),
 'cambridge-theatre': ('Cambridge Theatre', 'Earlham St', 'London', 'WC2H 9HU', 1200, 51.5136, -0.1268),
 'birmingham-town-hall': ('Town Hall', 'Victoria Square', 'Birmingham', 'B3 3DQ', 1100, 52.4795, -1.9036),
 'glasshouse': ('Glasshouse', "St Mary's Square, Gateshead Quays", 'Gateshead', 'NE8 2JR', 1700, 54.9677, -1.6014),
 'the-orchard': ('The Orchard Theatre', 'Home Gardens', 'Dartford', 'DA1 1ED', 950, 51.4459, 0.2185),
}
NOTE = ' Sample listing for the staging site, built from a real Ernest Promotions show; not on sale here.'
TOURS = {
 'e17': ('East 17: Boys Are Back Again', 'Music', "East 17's Winter / Christmas Tour 2026, with special guests Blazin' Squad. All the hits, a few Christmas surprises." + NOTE),
 'swoi': ('Snow White On Ice', 'Family', "The fairytale told on ice: Snow White, the Queen, the mirror and the seven dwarfs, with world-class skaters and a live-action forest. Fun for all the family." + NOTE),
 'ppoi': ('Peter Pan On Ice', 'Family', "Fly to Neverland with Peter, Wendy, Tinker Bell and Captain Hook, all on ice. A Christmas show for all ages, about two hours with an interval." + NOTE),
 'aswad': ('Aswad: Roots & Soul', 'Music', "Aswad with special guests The Real Thing, plus support from The Marley Experience. A night of reggae and soul classics." + NOTE),
 'sydnie': ('Sydnie Christmas: The Artist Tour', 'Music', "The Britain's Got Talent winner on her first UK theatre tour: musical theatre favourites, jazz standards and songs from her debut album." + NOTE),
}
# Ticket types per tour: (name, doorstep price, fee, face value). Face values from the PriceBands tab where we have them.
TT = {
 'e17': [('Standing', 1600, 150, 3250), ('Seated', 2750, 200, 5500)],
 'swoi': [('Standard', 1700, 150, 3500), ('Premium', 2200, 200, 4500)],
 'ppoi': [('Band A', 2400, 200, 4850), ('Band C', 1500, 150, 3250)],
 'aswad': [('General admission', 2200, 200, 4500)],
 'sydnie': [('Stalls', 2000, 200, 4000), ('Circle', 1500, 150, 3000)],
}
# (tour, venue, local start, image, sold per type (of 40 / 12), listed days ago, status)
# Sales are dummy numbers chosen so every flag shows: last_few (<=10 left), selling_fast (60%+ gone), new (listed <7 days).
E = [
 ('e17', 'albert-hall', '2026-11-24 20:00', 'east17-tour', (36, 10), 21, 'on_sale'),            # last few, tonight
 ('e17', 'uea', '2026-11-25 20:00', 'east17-tour', (14,), 21, 'on_sale'),
 ('e17', 'g-live', '2026-11-26 20:00', 'east17-tour', (12, 3), 21, 'on_sale'),
 ('e17', 'portsmouth-guildhall', '2026-12-01 20:00', 'east17-tour', (20, 4), 21, 'on_sale'),
 ('e17', 'tramshed', '2026-12-02 20:00', 'east17-tour', (40,), 21, 'sold_out'),
 ('e17', 'shepherds-bush-empire', '2026-12-03 19:30', 'east17-tour', (30, 6), 21, 'on_sale'),  # selling fast
 ('e17', 'the-halls', '2026-12-04 20:00', 'east17-tour', (11, 2), 21, 'on_sale'),
 ('swoi', 'connexin-live', '2026-12-18 19:00', 'snow-white', (9, 2), 3, 'on_sale'),              # new
 ('swoi', 'connexin-live', '2026-12-19 13:30', 'snow-white', (31, 7), 21, 'on_sale'),           # selling fast
 ('swoi', 'connexin-live', '2026-12-20 13:00', 'snow-white', (12, 3), 3, 'on_sale'),            # new
 ('ppoi', 'the-forum-bath', '2026-12-23 14:00', 'peter-pan-bath', (10, 4), 21, 'on_sale'),
 ('ppoi', 'the-forum-bath', '2026-12-27 14:00', 'peter-pan-bath', (36, 10), 21, 'on_sale'),      # last few
 ('ppoi', 'the-forum-bath', '2026-12-30 14:00', 'peter-pan-bath', (4, 9), 21, 'on_sale'),
 ('ppoi', 'theatre-severn', '2027-01-07 19:30', 'peter-pan-shrewsbury', (3, 5), 21, 'on_sale'),
 ('ppoi', 'theatre-severn', '2027-01-09 14:30', 'peter-pan-shrewsbury', (28, 6), 21, 'on_sale'), # selling fast
 ('aswad', 'o2-academy-leeds', '2027-05-01 19:00', 'aswad-leeds', (5,), 2, 'on_sale'),           # new
 ('aswad', 'prospect-building', '2027-05-09 19:00', 'aswad-bristol', (7,), 2, 'on_sale'),        # new
 ('sydnie', 'palace-southend', '2027-05-14 19:30', 'sydnie-christmas', (6, 2), 21, 'on_sale'),
 ('sydnie', 'the-lowry', '2027-05-16 19:30', 'sydnie-christmas', (9, 3), 21, 'on_sale'),
 ('sydnie', 'cambridge-theatre', '2027-05-17 19:30', 'sydnie-christmas', (28, 6), 21, 'on_sale'), # selling fast
 ('sydnie', 'birmingham-town-hall', '2027-05-19 19:30', 'sydnie-christmas', (5, 1), 21, 'on_sale'),
 ('sydnie', 'glasshouse', '2027-05-20 19:30', 'sydnie-christmas', (4, 0), 21, 'on_sale'),
 ('sydnie', 'the-orchard', '2027-05-22 19:30', 'sydnie-christmas', (7, 2), 21, 'on_sale'),
]
CAP = (40, 12)
q = lambda s: "'" + s.replace("'", "''") + "'"
vid = {k: f'5a000000-0000-4000-8000-{i:012d}' for i, k in enumerate(V, 1)}
out = []
w = out.append
w("""-- SAMPLE EVENTS for the staging site only (Nathan, 24 Nov 2026): Ernest Promotions' own upcoming shows, taken from the
-- Master Tickets sheet (tours, venues, dates, show times, face values), with the real artwork in /sample/ep/*.jpg.
-- Doorstep prices, allocations and sales are DUMMY numbers, chosen so every flag banner shows somewhere
-- (New, Selling fast, Last few) and one night is sold out. Peter Pan On Ice has no show times in the sheet, so 2pm is used.
-- Safe to run again: it deletes and recreates everything with slug 'sample-%'. Never run on production.
-- Needs migration 20261124160000_categories_and_flags.sql first (category names, listed_at).
-- Generated by scripts/sample-events/gen.py; edit that and regenerate rather than editing this file by hand.
begin;
delete from public.ticket_types where event_id in (select id from public.events where slug like 'sample-%');
delete from public.events where slug like 'sample-%';
delete from public.venues where slug like 'sample-%';

insert into public.venues (id, slug, name, address_line, city, postcode, timezone, capacity, lat, lng) values""")
w(',\n'.join(f"  ('{vid[k]}', 'sample-{k}', {q(n)}, {q(a)}, {q(c)}, {q(p)}, 'Europe/London', {cap}, {la}, {lo})" for k, (n, a, c, p, cap, la, lo) in V.items()) + ';\n')
w("insert into public.events (id, slug, venue_id, title, description, image_url, category, promoter_name, starts_at, doors_at, status, listed_at) values")
ev, tt, slugs = [], [], set()
for i, (t, v, start, img, sold, listed, status) in enumerate(E, 1):
    title, cat, desc = TOURS[t]
    city = V[v][2].lower()
    slug = f"sample-{t}-{city}-{start[:10]}"
    assert slug not in slugs; slugs.add(slug)
    eid = f'5b000000-0000-4000-8000-{i:012d}'
    st = f"'{start}:00 Europe/London'::timestamptz"
    ev.append(f"  ('{eid}', '{slug}', '{vid[v]}', {q(title)}, {q(desc)}, '/sample/ep/{img}.jpg', '{cat}', 'Ernest Promotions', {st}, {st} - interval '1 hour', '{status}', now() - interval '{listed} days')")
    for j, ((name, price, fee, face), s) in enumerate(zip(TT[t], sold)):
        tid = f"5{'cd'[j]}000000-0000-4000-8000-{i:012d}"
        tt.append(f"  ('{tid}', '{eid}', {q(name)}, {price}, {fee}, {face}, {CAP[j]}, {min(s, CAP[j])}, {j})")
w(',\n'.join(ev) + ';\n')
w("insert into public.ticket_types (id, event_id, name, price_pence, fee_pence, face_value_pence, capacity, sold, sort_order) values")
w(',\n'.join(tt) + ';\n')
w("commit;\n\nselect title, venue_city, starts_at, category, flag from public.event_listings where slug like 'sample-%' order by starts_at;")
sys.stdout.write('\n'.join(out) + '\n')
