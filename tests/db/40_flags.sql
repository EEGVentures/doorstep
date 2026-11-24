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
-- Categories and flag banners (24 Nov 2026).
select pg_temp.expect_error($q$ insert into public.events (slug, venue_id, title, category, starts_at, doors_at)
  values ('bad-cat', 'a0000000-0000-4000-8000-000000000001', 'x', 'Gig', now() + interval '9 days', now() + interval '9 days') $q$, 'events_category_known');
do $$ begin
  -- The rules, straight on the function: status, listed_at, override, capacity, left.
  assert public.event_flag('on_sale', now() - interval '30 days', null, 100, 100) is null, 'old, full stock: no flag';
  assert public.event_flag('on_sale', now() - interval '2 days', null, 100, 100) = 'new', 'listed 2 days ago: new';
  assert public.event_flag('on_sale', now() - interval '30 days', null, 100, 40) = 'selling_fast', '60% gone: selling fast';
  assert public.event_flag('on_sale', now() - interval '2 days', null, 100, 30) = 'selling_fast', 'selling fast beats new';
  assert public.event_flag('on_sale', now(), null, 100, 8) = 'last_few', '10 or fewer left: last few';
  assert public.event_flag('on_sale', now(), null, 500, 40) = 'last_few', 'under 10% left: last few';
  assert public.event_flag('sold_out', now(), null, 100, 0) is null, 'sold out: no flag';
  assert public.event_flag('on_sale', now(), null, 100, 0) is null, 'nothing left: no flag';
  assert public.event_flag('on_sale', now() - interval '30 days', 'selling_fast', 100, 100) = 'selling_fast', 'override sets a flag';
  assert public.event_flag('on_sale', now(), 'none', 100, 5) is null, 'override none hides it';
end $$;
-- Guests can read the flag and category on listings.
set role anon;
do $$ begin
  assert (select count(*) from public.event_listings where flag is not null or flag is null) >= 1, 'anon reads flag column';
end $$;
reset role;
\echo 'flags ok'
