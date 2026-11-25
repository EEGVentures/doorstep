-- Business-rule tests. Each block raises if a rule is broken.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

-- Fixtures ------------------------------------------------------------------
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000000a', 'member@test.local', '{"first_name":"Mia","last_name":"Member"}'),
  ('00000000-0000-0000-0000-00000000000b', 'partnerfan@test.local', '{"first_name":"Pat","last_name":"Partner"}'),
  ('00000000-0000-0000-0000-00000000000c', 'nobody@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000ad', 'admin@test.local', '{}');
update public.profiles set role = 'admin' where id = '00000000-0000-0000-0000-0000000000ad';

insert into public.venues (id, slug, name, city, address_line, postcode)
values ('10000000-0000-0000-0000-000000000001', 'tramshed-rules-test', 'Tramshed', 'Cardiff', 'Clive St, Grangetown', 'CF11 7EN');

-- Doors in 3 days (not yet revealed) and an event with doors in 24 hours (revealed).
insert into public.events (id, slug, venue_id, title, starts_at, doors_at, status) values
  ('20000000-0000-0000-0000-000000000001', 'later-show', '10000000-0000-0000-0000-000000000001', 'Later Show',
     now() + interval '3 days 1 hour', now() + interval '3 days', 'on_sale'),
  ('20000000-0000-0000-0000-000000000002', 'soon-show', '10000000-0000-0000-0000-000000000001', 'Soon Show',
     now() + interval '25 hours', now() + interval '24 hours', 'on_sale');

insert into public.ticket_types (id, event_id, name, price_pence, fee_pence, capacity) values
  ('30000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'General admission', 1260, 150, 3),
  ('30000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000002', 'General admission', 1000, 100, 10);

insert into public.partners (id, name, status, approved_at) values
  ('40000000-0000-0000-0000-000000000001', 'Blue Light Test Partner', 'approved', now()),
  ('40000000-0000-0000-0000-000000000002', 'Unapproved Partner', 'pending', null);
insert into public.affiliate_links (id, partner_id, event_id, code) values
  ('50000000-0000-0000-0000-000000000001', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000001', 'BLUELIGHT-LATER'),
  ('50000000-0000-0000-0000-000000000002', '40000000-0000-0000-0000-000000000002', '20000000-0000-0000-0000-000000000001', 'PENDING-PARTNER'),
  ('50000000-0000-0000-0000-000000000003', '40000000-0000-0000-0000-000000000001', '20000000-0000-0000-0000-000000000002', 'BLUELIGHT-SOON');

create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin
    execute sql;
  exception when others then
    failed := true; msg := sqlerrm;
  end;
  if not failed then
    raise exception 'expected % but the statement succeeded: %', code, sql;
  end if;
  if msg not like '%' || code || '%' then
    raise exception 'expected %, got: %', code, msg;
  end if;
end $$;

-- 1. Profiles are created from auth users ---------------------------------
do $$ begin
  assert (select count(*) from public.profiles) = 4, 'profile per auth user';
  assert (select first_name from public.profiles where email = 'member@test.local') = 'Mia', 'name copied';
end $$;

-- 2. No membership gate (Nathan, 24 Nov 2026): any signed-in customer buys 'direct' --------
do $$
declare o public.orders;
begin
  o := public.create_reservation('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 1);
  assert o.route = 'direct', 'direct route for a customer without a partner link';
  assert o.affiliate_link_id is null, 'no link on a direct order';
  perform public.release_reservation(o.reservation_id, 'cancelled');
end $$;

-- 3. Partner link is tracked on the order; unapproved partner or wrong event is refused
select pg_temp.expect_error($q$ select public.create_reservation('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 1, 'PENDING-PARTNER') $q$, 'DS_AFFILIATE_INVALID');
select pg_temp.expect_error($q$ select public.create_reservation('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 1, 'BLUELIGHT-SOON') $q$, 'DS_AFFILIATE_INVALID');
do $$
declare o public.orders;
begin
  o := public.create_reservation('00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1, 'bluelight-later');
  assert o.route = 'affiliate', 'affiliate route recorded';
  assert o.affiliate_link_id = '50000000-0000-0000-0000-000000000001', 'link recorded on order';
  assert o.total_pence = 1410, 'price 12.60 + 1.50 fee';
  assert o.ref ~ '^DS-[A-HJ-NP-Z2-9]{6}$', 'order ref format';
  perform public.release_reservation(o.reservation_id, 'cancelled');
end $$;

-- 4. Quantity limit (6 per order by default)
select pg_temp.expect_error($q$ select public.create_reservation('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000002', 7) $q$, 'DS_TOO_MANY');

-- 5. No oversell: capacity 3, member holds 2, partner fan wants 2 -> sold out
do $$
declare o public.orders;
begin
  o := public.create_reservation('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 2);
  assert (select held from public.ticket_types where id = '30000000-0000-0000-0000-000000000001') = 2, 'held 2';
end $$;
select pg_temp.expect_error($q$ select public.create_reservation('00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 2, 'BLUELIGHT-LATER') $q$, 'DS_SOLD_OUT');

-- 5b. Holds: a new hold on the same event replaces the old one; at most 3 events held at once per account
do $$
declare o1 public.orders; o2 public.orders;
begin
  o1 := public.create_reservation('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000002', 1);
  o2 := public.create_reservation('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000002', 2);
  assert (select status from public.reservations where id = o1.reservation_id) <> 'active', 'earlier hold on the same event released';
  assert (select count(*) from public.reservations where user_id = '00000000-0000-0000-0000-00000000000c' and status = 'active') = 1, 'one hold per event';
  insert into public.reservations (user_id, ticket_type_id, quantity, route, expires_at)
    select '00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000001', 1, 'direct', now() + interval '30 minutes' from generate_series(1, 3);
end $$;
select pg_temp.expect_error($q$ select public.create_reservation('00000000-0000-0000-0000-00000000000c', '30000000-0000-0000-0000-000000000002', 1) $q$, 'DS_HOLD_LIMIT');
update public.reservations set status = 'cancelled' where user_id = '00000000-0000-0000-0000-00000000000c' and status = 'active' and ticket_type_id = '30000000-0000-0000-0000-000000000001';
select public.release_reservation(id, 'cancelled') from public.reservations where user_id = '00000000-0000-0000-0000-00000000000c' and status = 'active';

-- 6. Fulfilment issues random unique barcodes, is idempotent and checks the amount
do $$
declare o public.orders; o2 public.orders; n int;
begin
  select * into o from public.orders where user_id = '00000000-0000-0000-0000-00000000000a' and status = 'pending_payment';
  o := public.fulfil_order(o.id, 'pi_test_1', o.total_pence);
  assert o.status = 'paid', 'paid';
  o2 := public.fulfil_order(o.id, 'pi_test_1', o.total_pence);
  select count(*) into n from public.tickets where order_id = o.id;
  assert n = 2, 'exactly 2 tickets after duplicate webhook';
  assert (select sold from public.ticket_types where id = o.ticket_type_id) = 2, 'sold 2';
  assert (select held from public.ticket_types where id = o.ticket_type_id) = 0, 'held back to 0';
  assert (select count(*) from public.ticket_barcodes b join public.tickets t on t.id = b.ticket_id where t.order_id = o.id and b.barcode ~ '^[A-HJ-NP-Z2-9]{12}$') = 2, 'barcode format';
end $$;

do $$
declare o public.orders;
begin
  o := public.create_reservation('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000002', 1);
  o := public.fulfil_order(o.id, 'pi_wrong_amount', 1);
  assert o.status = 'exception', 'amount mismatch is an exception, not paid';
  assert (select count(*) from public.tickets where order_id = o.id) = 0, 'no tickets on mismatch';
end $$;

-- 7. Late payment after expiry: re-claims stock if available, else exception (never oversell)
do $$
declare o public.orders; o_late public.orders;
begin
  -- 1 left on the later show. Partner fan holds it, the hold expires, then a member takes the last one.
  o_late := public.create_reservation('00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000001', 1, 'BLUELIGHT-LATER', interval '0 seconds');
  assert public.expire_stale_reservations() >= 1, 'stale hold expired';
  assert (select status from public.orders where id = o_late.id) = 'expired', 'order expired';
  o := public.create_reservation('00000000-0000-0000-0000-00000000000a', '30000000-0000-0000-0000-000000000001', 1);
  o := public.fulfil_order(o.id, 'pi_last', o.total_pence);
  assert (select status from public.events where id = '20000000-0000-0000-0000-000000000001') = 'sold_out', 'event marked sold out';
  o_late := public.fulfil_order(o_late.id, 'pi_late', o_late.total_pence);
  assert o_late.status = 'exception', 'late payment with no stock is an exception';
  assert (select sold from public.ticket_types where id = '30000000-0000-0000-0000-000000000001') = 3, 'still exactly capacity';
end $$;

-- 8. Refund revokes tickets, returns stock, never reuses a barcode
do $$
declare o public.orders; codes text[]; t_count int;
begin
  select * into o from public.orders where stripe_payment_intent_id = 'pi_test_1';
  select array_agg(b.barcode) into codes from public.ticket_barcodes b join public.tickets t on t.id = b.ticket_id where t.order_id = o.id;
  o := public.record_refund(o.id, o.total_pence, 'Customer request', 're_test_1');
  o := public.record_refund(o.id, o.total_pence, 'Customer request', 're_test_1'); -- duplicate webhook
  assert o.status = 'refunded', 'refunded';
  assert (select count(*) from public.refunds where order_id = o.id) = 1, 'one refund row';
  assert (select count(*) from public.tickets where order_id = o.id and status = 'revoked') = 2, 'tickets revoked';
  assert (select sold from public.ticket_types where id = o.ticket_type_id) = 1, 'stock returned';
  assert (select status from public.events where id = o.event_id) = 'on_sale', 'back on sale';
  assert (select count(*) from public.ticket_barcodes where barcode = any(codes)) = 2, 'old codes kept, so they can never be issued again';
end $$;
select pg_temp.expect_error($q$ delete from public.ticket_barcodes $q$, 'immutable');
select pg_temp.expect_error($q$ update public.ticket_barcodes set barcode = 'AAAAAAAAAAAA' $q$, 'immutable');

-- 9. Membership storage is gone
do $$ begin
  assert to_regclass('public.membership_entitlements') is null, 'no membership table';
  assert to_regprocedure('public.has_active_membership(uuid)') is null, 'no membership check';
end $$;

-- 10. Partner reporting and attribution
do $$
declare o public.orders;
begin
  insert into public.affiliate_link_visits (link_id, visitor_id) values
    ('50000000-0000-0000-0000-000000000003', 'v1'), ('50000000-0000-0000-0000-000000000003', 'v1'), ('50000000-0000-0000-0000-000000000003', 'v2');
  perform public.attribute_user_to_link('00000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000003', 'v1');
  perform public.attribute_user_to_link('00000000-0000-0000-0000-00000000000b', '50000000-0000-0000-0000-000000000001', 'v9'); -- first touch wins
  o := public.create_reservation('00000000-0000-0000-0000-00000000000b', '30000000-0000-0000-0000-000000000002', 2, 'BLUELIGHT-SOON');
  o := public.fulfil_order(o.id, 'pi_partner', o.total_pence);
  assert (select acquired_via_link_id from public.profiles where id = '00000000-0000-0000-0000-00000000000b') = '50000000-0000-0000-0000-000000000003', 'first touch kept';
  assert (select visits from public.affiliate_link_stats where code = 'BLUELIGHT-SOON') = 3, 'visits';
  assert (select unique_visitors from public.affiliate_link_stats where code = 'BLUELIGHT-SOON') = 2, 'unique visitors';
  assert (select signups from public.affiliate_link_stats where code = 'BLUELIGHT-SOON') = 1, 'signups';
  assert (select tickets_sold from public.affiliate_link_stats where code = 'BLUELIGHT-SOON') = 2, 'tickets sold';
  assert (select net_pence from public.partner_sales_ledger where order_ref = o.ref) = 2200, 'ledger net';
  assert (select new_customer_via_link from public.partner_sales_ledger where order_ref = o.ref), 'new customer flag';
end $$;

-- 11. Row-level security --------------------------------------------------
-- Partner fan (b) has 2 tickets for the Soon Show (doors in 24h).
-- Member (a) has 1 valid ticket for the Later Show (doors in 3 days). Door passes show on purchase
-- (25 Nov 2026), so both see their codes now, however far off the show is.
set role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
do $$ begin
  assert (select count(*) from public.profiles) = 1, 'sees only own profile';
  assert (select count(*) from public.orders where user_id <> auth.uid()) = 0, 'no other orders';
  assert (select count(*) from public.tickets where user_id <> auth.uid()) = 0, 'no other tickets';
  assert (select count(*) from public.ticket_barcodes) = 1, 'door pass code visible straight after purchase, days before doors';
  assert (select count(*) from public.my_tickets where status = 'valid' and barcode is not null) = 1, 'wallet shows the code on purchase';
  assert (select count(*) from public.my_tickets where status <> 'valid' and barcode is not null) = 0, 'no code for a refunded or revoked ticket';
  assert (select count(*) from public.affiliate_link_stats) = 0, 'customers cannot see partner stats';
  assert (select count(*) from public.partner_sales_ledger) = 0, 'customers cannot see the partner ledger';
  assert (select count(*) from public.event_listings) = 3, 'public listings';
end $$;
select pg_temp.expect_error($q$ update public.profiles set role = 'admin' where id = auth.uid() $q$, 'permission denied');
select pg_temp.expect_error($q$ select public.create_reservation(auth.uid(), '30000000-0000-0000-0000-000000000002', 1) $q$, 'permission denied');
update public.profiles set first_name = 'Mia B' where id = auth.uid();

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000b', false);
do $$ begin
  assert (select count(*) from public.ticket_barcodes) = 2, 'own codes visible';
  assert (select count(*) from public.my_tickets where barcode is not null) = 2, 'wallet shows codes';
end $$;

select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-0000000000ad', false);
do $$ begin
  assert (select count(*) from public.affiliate_link_stats) = 4, 'admin sees partner stats';
  assert (select count(*) from public.partner_sales_ledger) >= 1, 'admin sees ledger';
end $$;

reset role;
set role anon;
do $$ begin
  assert (select count(*) from public.event_listings) = 3, 'anon sees listings';
end $$;
-- Guests have no grant at all on private tables (stronger than RLS hiding rows).
select pg_temp.expect_error($q$ select count(*) from public.orders $q$, 'permission denied');
select pg_temp.expect_error($q$ select count(*) from public.ticket_barcodes $q$, 'permission denied');
select pg_temp.expect_error($q$ select count(*) from public.profiles $q$, 'permission denied');
reset role;
\echo 'rules ok'
