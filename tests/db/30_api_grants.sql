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
