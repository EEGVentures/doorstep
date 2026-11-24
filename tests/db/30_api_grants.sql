-- API role access (new Supabase projects give none by default; see the 20261124 migration).
do $$ begin
  assert has_table_privilege('anon', 'public.events', 'select'), 'guests must read events';
  assert has_table_privilege('anon', 'public.event_listings', 'select'), 'guests must read event_listings';
  assert not has_table_privilege('anon', 'public.orders', 'select'), 'guests must not read orders';
  assert not has_table_privilege('anon', 'public.ticket_barcodes', 'select'), 'guests must not read barcodes';
  assert not has_table_privilege('authenticated', 'public.orders', 'insert'), 'customers never write orders directly';
  assert has_table_privilege('authenticated', 'public.my_tickets', 'select'), 'customers read their wallet';
  assert has_table_privilege('service_role', 'public.orders', 'insert'), 'server writes orders';
  assert not has_function_privilege('authenticated', 'public.create_reservation(uuid, uuid, int, text, interval)', 'execute'), 'reservations are server-only';
  assert has_function_privilege('service_role', 'public.create_reservation(uuid, uuid, int, text, interval)', 'execute'), 'server makes reservations';
end $$;

-- Prices for signed-in customers only (Nathan, 24 Nov 2026): guests can't read price columns,
-- and listings carry no price for them.
do $$ begin
  assert not has_column_privilege('anon', 'public.ticket_types', 'price_pence', 'select'), 'guests cannot read prices';
  assert has_column_privilege('anon', 'public.ticket_types', 'capacity', 'select'), 'guests can see availability';
  assert has_column_privilege('authenticated', 'public.ticket_types', 'price_pence', 'select'), 'customers see prices';
end $$;
set role anon;
do $$ begin
  assert (select count(*) from public.event_listings where from_price_pence is not null) = 0, 'no prices in guest listings';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '00000000-0000-0000-0000-00000000000a', false);
set role authenticated;
do $$ begin
  assert (select count(*) from public.event_listings where from_price_pence is not null) > 0, 'signed-in listings carry prices';
end $$;
reset role;
select set_config('request.jwt.claim.sub', '', false);
