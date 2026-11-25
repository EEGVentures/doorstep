-- Welcome email (25 Nov 2026). Every new account gets one welcome email, queued in the
-- same transaction that creates the profile, so it can't be missed or sent twice
-- (dedupe key welcome:<user id>). The cron tick sends it through Resend.
-- Accounts copied over in bulk (for example from Base44) set skip_welcome = true in
-- their user metadata so existing customers are not welcomed again.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  v_first text := nullif(new.raw_user_meta_data ->> 'first_name', '');
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    v_first,
    nullif(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;

  if coalesce(new.email, '') <> ''
     and coalesce((new.raw_user_meta_data ->> 'skip_welcome')::boolean, false) = false then
    insert into public.email_outbox (template, to_email, user_id, payload, dedupe_key)
    values ('welcome', new.email, new.id, jsonb_build_object('first_name', coalesce(v_first, 'there')), 'welcome:' || new.id)
    on conflict (dedupe_key) do nothing;
  end if;
  return new;
end $$;
