-- Welcome email rules (25 Nov 2026): one welcome per new account, none for bulk-copied accounts.
\set ON_ERROR_STOP 1
set client_min_messages = warning;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'welcome@test.local', '{"first_name":"Wren"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'noname@test.local', '{}'),
  ('00000000-0000-0000-0000-0000000000e3', 'imported@test.local', '{"first_name":"Ivy","skip_welcome":true}'),
  ('00000000-0000-0000-0000-0000000000e4', null, '{}');

do $$
declare r record; n int;
begin
  select * into r from public.email_outbox where dedupe_key = 'welcome:00000000-0000-0000-0000-0000000000e1';
  if r is null then raise exception 'new account did not get a welcome email'; end if;
  if r.template <> 'welcome' or r.to_email <> 'welcome@test.local' or r.status <> 'queued' then
    raise exception 'welcome email queued wrongly: % % %', r.template, r.to_email, r.status;
  end if;
  if r.payload ->> 'first_name' <> 'Wren' then raise exception 'welcome email has the wrong first name'; end if;

  select payload ->> 'first_name' as first_name into strict r from public.email_outbox where dedupe_key = 'welcome:00000000-0000-0000-0000-0000000000e2';
  if r.first_name <> 'there' then raise exception 'welcome email without a name should say "there"'; end if;

  select count(*) into n from public.email_outbox where dedupe_key in
    ('welcome:00000000-0000-0000-0000-0000000000e3', 'welcome:00000000-0000-0000-0000-0000000000e4');
  if n <> 0 then raise exception 'bulk-copied or address-less accounts must not get a welcome email'; end if;

  select count(*) into n from public.email_outbox where template = 'welcome' and user_id = '00000000-0000-0000-0000-0000000000e1';
  if n <> 1 then raise exception 'expected exactly one welcome email, got %', n; end if;
end $$;
