-- Holding page sign-ups: rate limit, validation, no duplicates, consent recorded and never silently dropped,
-- and nothing readable or callable by the public API roles.
\set ON_ERROR_STOP 1
set client_min_messages = warning;
\pset tuples_only on
\pset format unaligned

create or replace function pg_temp.expect_error(sql text, code text) returns void language plpgsql as $$
declare failed boolean := false; msg text;
begin
  begin execute sql; exception when others then failed := true; msg := sqlerrm; end;
  if not failed then raise exception 'expected % but the statement succeeded: %', code, sql; end if;
  if msg not like '%' || code || '%' then raise exception 'expected %, got: %', code, msg; end if;
end $$;

-- Valid sign-up, no marketing.
do $$ begin
  assert public.register_launch_interest('Sam@Example.com ', false, null, 'ig', 'hash-aaaaaaaaaaaaaaaa') = 'ok';
  assert (select count(*) from public.launch_signups where email = 'sam@example.com') = 1, 'stored lower-cased';
  assert (select marketing_consent from public.launch_signups where email = 'sam@example.com') = false;
end $$;

-- Same email again with marketing ticked: one row, consent recorded with text and time.
do $$ begin
  assert public.register_launch_interest('sam@example.com', true, 'Also send me occasional emails', null, 'hash-bbbbbbbbbbbbbbbb') = 'ok';
  assert (select count(*) from public.launch_signups where lower(email) = 'sam@example.com') = 1, 'no duplicate';
  assert (select marketing_consent and marketing_consent_text is not null and marketing_consent_at is not null
            from public.launch_signups where email = 'sam@example.com'), 'consent recorded';
end $$;

-- Signing up again without the tick keeps the earlier yes.
do $$ begin
  perform public.register_launch_interest('sam@example.com', false, null, null, 'hash-cccccccccccccccc');
  assert (select marketing_consent from public.launch_signups where email = 'sam@example.com'), 'consent not silently removed';
end $$;

-- Validation.
select pg_temp.expect_error($$select public.register_launch_interest('not-an-email', false, null, null, 'hash-dddddddddddddddd')$$, 'DS_BAD_EMAIL');
select pg_temp.expect_error($$select public.register_launch_interest('a@b.co', true, '  ', null, 'hash-eeeeeeeeeeeeeeee')$$, 'DS_CONSENT_TEXT_REQUIRED');
select pg_temp.expect_error($$select public.register_launch_interest('a@b.co', false, null, null, null)$$, 'DS_BAD_REQUEST');

-- Rate limit: five attempts an hour per IP hash, then refused.
do $$ declare i int; begin
  for i in 1..5 loop perform public.register_launch_interest('rate' || i || '@example.com', false, null, null, 'hash-ffffffffffffffff'); end loop;
end $$;
select pg_temp.expect_error($$select public.register_launch_interest('rate6@example.com', false, null, null, 'hash-ffffffffffffffff')$$, 'DS_RATE_LIMITED');
do $$ begin
  assert (select count(*) from public.launch_signups where email = 'rate6@example.com') = 0, 'rate-limited sign-up not stored';
end $$;

-- Public API roles can neither read the list nor call the function.
set role anon;
select pg_temp.expect_error($$select count(*) from public.launch_signups$$, 'permission denied');
select pg_temp.expect_error($$select public.register_launch_interest('x@example.com', false, null, null, 'hash-gggggggggggggggg')$$, 'permission denied');
reset role;
set role authenticated;
select pg_temp.expect_error($$select count(*) from public.launch_signups$$, 'permission denied');
select pg_temp.expect_error($$insert into public.launch_signups (email) values ('x@example.com')$$, 'permission denied');
reset role;
\echo 'launch sign-ups ok'
