-- Holding page (doorsteptickets.com before launch): "first access" sign-ups.
-- Server-only. RLS on with no policies, and no grants to anon/authenticated, so only the
-- service role (the holding page's /api/signup function) can touch it.
-- We store the email, whether they also opted in to marketing (with the exact wording they saw
-- and when), and a salted hash of their IP for rate limiting. No raw IPs.

create table if not exists public.launch_signups (
  id uuid primary key default gen_random_uuid(),
  email text not null,
  marketing_consent boolean not null default false,
  marketing_consent_text text,
  marketing_consent_at timestamptz,
  source text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unsubscribed_at timestamptz,
  constraint launch_signups_email_format check (email ~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' and length(email) <= 254),
  constraint launch_signups_consent_has_text check (not marketing_consent or (marketing_consent_text is not null and marketing_consent_at is not null))
);
create unique index if not exists launch_signups_email_key on public.launch_signups (lower(email));

create table if not exists public.launch_signup_attempts (
  id bigint generated always as identity primary key,
  ip_hash text not null,
  at timestamptz not null default now()
);
create index if not exists launch_signup_attempts_ip_at on public.launch_signup_attempts (ip_hash, at desc);

alter table public.launch_signups enable row level security;
alter table public.launch_signup_attempts enable row level security;
revoke all on public.launch_signups, public.launch_signup_attempts from public, anon, authenticated;

-- One call per form submit. Rules:
--  * at most 5 attempts per IP hash per hour (DS_RATE_LIMITED)
--  * email must look like an email (DS_BAD_EMAIL)
--  * the same email twice is not an error and never reveals that it was already there
--  * ticking marketing records consent with its wording and time; not ticking never removes an earlier yes
--    (withdrawal is by unsubscribe, which sets unsubscribed_at)
create or replace function public.register_launch_interest(
  p_email text,
  p_marketing boolean,
  p_consent_text text,
  p_source text,
  p_ip_hash text
) returns text
language plpgsql
security definer
set search_path = public
as $$
declare
  v_email text := lower(trim(coalesce(p_email, '')));
  v_recent int;
begin
  if p_ip_hash is null or length(p_ip_hash) < 16 then
    raise exception 'DS_BAD_REQUEST';
  end if;

  select count(*) into v_recent from launch_signup_attempts
   where ip_hash = p_ip_hash and at > now() - interval '1 hour';
  if v_recent >= 5 then
    raise exception 'DS_RATE_LIMITED';
  end if;
  insert into launch_signup_attempts (ip_hash) values (p_ip_hash);

  if v_email !~ '^[^\s@]+@[^\s@]+\.[^\s@]{2,}$' or length(v_email) > 254 then
    raise exception 'DS_BAD_EMAIL';
  end if;
  if coalesce(p_marketing, false) and nullif(trim(coalesce(p_consent_text, '')), '') is null then
    raise exception 'DS_CONSENT_TEXT_REQUIRED';
  end if;

  insert into launch_signups as s (email, marketing_consent, marketing_consent_text, marketing_consent_at, source)
  values (
    v_email,
    coalesce(p_marketing, false),
    case when p_marketing then left(p_consent_text, 500) end,
    case when p_marketing then now() end,
    left(nullif(trim(coalesce(p_source, '')), ''), 64)
  )
  on conflict (lower(email)) do update set
    marketing_consent = s.marketing_consent or excluded.marketing_consent,
    marketing_consent_text = case when excluded.marketing_consent then excluded.marketing_consent_text else s.marketing_consent_text end,
    marketing_consent_at = case when excluded.marketing_consent then excluded.marketing_consent_at else s.marketing_consent_at end,
    unsubscribed_at = case when excluded.marketing_consent then null else s.unsubscribed_at end,
    updated_at = now();

  -- Keep the attempts table small.
  delete from launch_signup_attempts where at < now() - interval '1 day';
  return 'ok';
end;
$$;

revoke all on function public.register_launch_interest(text, boolean, text, text, text) from public, anon, authenticated;
grant execute on function public.register_launch_interest(text, boolean, text, text, text) to service_role;
grant select, insert, update, delete on public.launch_signups, public.launch_signup_attempts to service_role;
