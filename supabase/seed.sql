-- Staging/test fixtures only. Never run against production.
-- Tramshed, Cardiff is the first close-off venue (approved by Nathan, 4 Nov 2026) with the internal test recipient.
insert into public.venues (id, slug, name, address_line, city, postcode, timezone, capacity, lat, lng)
values ('a0000000-0000-4000-8000-000000000001', 'tramshed-cardiff', 'Tramshed', 'Clive St, Grangetown', 'Cardiff', 'CF11 7EN', 'Europe/London', 1000, 51.4706, -3.1937)
on conflict (id) do nothing;

insert into public.venue_closeoff_settings (venue_id, recipients, sending_enabled, notes)
values ('a0000000-0000-4000-8000-000000000001', array['nathan@ernestpromotions.com'], false,
        'TEST TEMPLATE. Real box-office contact not supplied yet. Live sending stays off until Nathan approves it for a real event.')
on conflict (venue_id) do nothing;

-- A fixture event three weeks out, 7pm doors.
insert into public.events (id, slug, venue_id, title, description, category, promoter_name, starts_at, doors_at, status)
values ('b0000000-0000-4000-8000-000000000001', 'test-night-tramshed', 'a0000000-0000-4000-8000-000000000001',
        'Doorstep Test Night', 'A fixture event for testing checkout, door passes and close-off reports. Not a real show.',
        'Music', 'Doorstep (test)',
        date_trunc('day', now() at time zone 'Europe/London' + interval '21 days') at time zone 'Europe/London' + interval '20 hours',
        date_trunc('day', now() at time zone 'Europe/London' + interval '21 days') at time zone 'Europe/London' + interval '19 hours',
        'on_sale')
on conflict (id) do nothing;

insert into public.ticket_types (id, event_id, name, price_pence, fee_pence, face_value_pence, capacity, sort_order) values
  ('c0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'General admission', 1260, 150, 2100, 50, 0),
  ('c0000000-0000-4000-8000-000000000002', 'b0000000-0000-4000-8000-000000000001', 'Balcony', 1500, 150, 2500, 10, 1)
on conflict (id) do nothing;

-- A test partner and show link: /go/BLC-TEST is tracked and greets Blue Light visitors.
insert into public.partners (id, name, contact_email, status, approved_at)
values ('d0000000-0000-4000-8000-000000000001', 'Blue Light Card (test)', null, 'approved', now())
on conflict (id) do nothing;
update public.partners set welcome_title = 'Thank you to our Blue Light services!',
  welcome_line = 'Book this night through your Blue Light Card link.'
 where id = 'd0000000-0000-4000-8000-000000000001' and welcome_title is null;
insert into public.affiliate_links (id, partner_id, event_id, code)
values ('e0000000-0000-4000-8000-000000000001', 'd0000000-0000-4000-8000-000000000001', 'b0000000-0000-4000-8000-000000000001', 'BLC-TEST')
on conflict (id) do nothing;
