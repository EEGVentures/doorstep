-- Doorstep core schema (Supabase Postgres).
-- Money is always integer pence (GBP). Times are timestamptz (UTC) plus an IANA timezone on the venue.
-- Rules carried from the 14 Oct 2026 code audit and docs/08 (4 Nov 2026):
--   * barcodes are random, unique forever, never reused or resold
--   * buyers can read a barcode only from 48 hours before doors (enforced here, not in the UI)
--   * stock is claimed in one transaction, so the last ticket can only be sold once
--   * every purchase needs an active membership OR a valid affiliate link for that event

create extension if not exists pgcrypto with schema extensions;

-- ---------------------------------------------------------------------------
-- Types
-- ---------------------------------------------------------------------------
create type public.app_role as enum ('customer', 'promoter', 'ops', 'admin');
create type public.event_status as enum ('draft', 'on_sale', 'sold_out', 'sales_closed', 'completed', 'cancelled');
create type public.event_visibility as enum ('public', 'unlisted');
create type public.purchase_route as enum ('member', 'affiliate', 'comp');
create type public.reservation_status as enum ('active', 'consumed', 'expired', 'cancelled');
create type public.order_status as enum ('pending_payment', 'paid', 'refunded', 'partially_refunded', 'expired', 'cancelled', 'exception');
create type public.ticket_status as enum ('valid', 'revoked');
create type public.membership_source as enum ('stripe', 'apple', 'comp');
create type public.membership_status as enum ('trialing', 'active', 'past_due', 'in_grace', 'canceled', 'expired', 'incomplete', 'paused');
create type public.partner_status as enum ('pending', 'approved', 'suspended');
create type public.affiliate_link_status as enum ('active', 'paused', 'expired');
create type public.closeoff_kind as enum ('preview', 'final', 'revision');
create type public.delivery_status as enum ('pending', 'sent', 'failed', 'held_test_mode', 'skipped_disabled');
create type public.outbox_status as enum ('queued', 'sending', 'sent', 'failed', 'cancelled');

-- ---------------------------------------------------------------------------
-- Shared helpers
-- ---------------------------------------------------------------------------
create or replace function public.touch_updated_at() returns trigger
language plpgsql as $$
begin
  new.updated_at := now();
  return new;
end $$;

-- One platform-wide reveal rule (docs/08 section 1). Change here only.
create or replace function public.reveal_lead() returns interval
language sql immutable as $$ select interval '48 hours' $$;

-- ---------------------------------------------------------------------------
-- People
-- ---------------------------------------------------------------------------
create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  first_name text,
  last_name text,
  home_city text,
  home_postcode text,
  role public.app_role not null default 'customer',
  stripe_customer_id text unique,
  marketing_email_consent boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function public.touch_updated_at();

-- Create a profile for every new auth user.
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email, first_name, last_name)
  values (
    new.id,
    coalesce(new.email, ''),
    nullif(new.raw_user_meta_data ->> 'first_name', ''),
    nullif(new.raw_user_meta_data ->> 'last_name', '')
  )
  on conflict (id) do nothing;
  return new;
end $$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

create or replace function public.current_role_is(variadic roles public.app_role[]) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles p where p.id = auth.uid() and p.role = any (roles))
$$;

-- Append-only consent history. Never infer opt-in from a missing row.
create table public.consent_events (
  id bigint generated always as identity primary key,
  user_id uuid not null references public.profiles (id) on delete cascade,
  channel text not null check (channel in ('email', 'push', 'sms')),
  purpose text not null default 'marketing',
  action text not null check (action in ('granted', 'withdrawn')),
  policy_version text not null,
  source text not null,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Membership (one entitlement, fed by Stripe Billing on web and Apple IAP on iOS)
-- ---------------------------------------------------------------------------
create table public.membership_entitlements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id) on delete cascade,
  source public.membership_source not null,
  -- Stripe subscription id, Apple originalTransactionId, or a comp reference.
  provider_ref text not null,
  status public.membership_status not null,
  product_ref text,                       -- Stripe price id or App Store product id
  current_period_end timestamptz,
  cancel_at_period_end boolean not null default false,
  grace_until timestamptz,                -- access continues until this time while a payment is retried
  last_provider_event_at timestamptz,     -- ignore provider events older than this (out-of-order delivery)
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (source, provider_ref)
);
create index membership_entitlements_user on public.membership_entitlements (user_id);
create trigger membership_touch before update on public.membership_entitlements
  for each row execute function public.touch_updated_at();

create or replace function public.has_active_membership(p_user uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (
    select 1 from public.membership_entitlements m
    where m.user_id = p_user
      and (
        (m.status in ('active', 'trialing') and (m.current_period_end is null or m.current_period_end > now()))
        or (m.status in ('past_due', 'in_grace') and coalesce(m.grace_until, m.current_period_end) > now())
        -- A cancelled subscription keeps access until the end of the period already paid for.
        or (m.status = 'canceled' and m.current_period_end > now())
      )
  )
$$;

-- ---------------------------------------------------------------------------
-- Catalogue
-- ---------------------------------------------------------------------------
create table public.venues (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  address_line text,
  city text not null,
  postcode text,
  timezone text not null default 'Europe/London',
  lat double precision,
  lng double precision,
  capacity integer check (capacity is null or capacity > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger venues_touch before update on public.venues
  for each row execute function public.touch_updated_at();

-- Private venue settings: close-off recipients and schedule. Never exposed publicly.
create table public.venue_closeoff_settings (
  venue_id uuid primary key references public.venues (id) on delete cascade,
  recipients text[] not null default '{}',
  -- Live sending to the venue stays off until Nathan approves it per venue.
  sending_enabled boolean not null default false,
  preview_lead interval not null default interval '48 hours',
  final_lead interval not null default interval '4 hours',
  revision_every interval not null default interval '30 minutes',
  revision_stop_lead interval not null default interval '30 minutes',
  ack_due_lead interval not null default interval '2 hours',
  notes text,
  updated_at timestamptz not null default now()
);
create trigger venue_closeoff_touch before update on public.venue_closeoff_settings
  for each row execute function public.touch_updated_at();

create table public.events (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  venue_id uuid not null references public.venues (id),
  title text not null,
  description text,
  image_url text,
  promoter_name text,
  category text,
  starts_at timestamptz not null,
  doors_at timestamptz not null,
  sales_close_at timestamptz,
  status public.event_status not null default 'draft',
  visibility public.event_visibility not null default 'public',
  -- Optional per-event overrides of the venue close-off schedule.
  closeoff_final_lead interval,
  closeoff_recipients_override text[],
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (doors_at <= starts_at),
  check (sales_close_at is null or sales_close_at <= starts_at)
);
create index events_status_doors on public.events (status, doors_at);
create trigger events_touch before update on public.events
  for each row execute function public.touch_updated_at();

create table public.ticket_types (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  name text not null,
  price_pence integer not null check (price_pence >= 0),
  fee_pence integer not null default 0 check (fee_pence >= 0),
  face_value_pence integer check (face_value_pence is null or face_value_pence >= 0),
  capacity integer not null check (capacity >= 0),
  sold integer not null default 0 check (sold >= 0),
  held integer not null default 0 check (held >= 0),
  max_per_order integer not null default 6 check (max_per_order between 1 and 20),
  sort_order integer not null default 0,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint ticket_types_no_oversell check (sold + held <= capacity)
);
create index ticket_types_event on public.ticket_types (event_id);
create trigger ticket_types_touch before update on public.ticket_types
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Affiliates (the only route to buy without a membership)
-- ---------------------------------------------------------------------------
create table public.partners (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  contact_email text,
  status public.partner_status not null default 'pending',
  approved_by uuid references public.profiles (id),
  approved_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (status <> 'approved' or approved_at is not null)
);
create trigger partners_touch before update on public.partners
  for each row execute function public.touch_updated_at();

create table public.affiliate_links (
  id uuid primary key default gen_random_uuid(),
  partner_id uuid not null references public.partners (id),
  event_id uuid not null references public.events (id) on delete cascade,
  code text not null unique check (code ~ '^[A-Z0-9-]{4,40}$'),
  status public.affiliate_link_status not null default 'active',
  max_per_order integer not null default 6 check (max_per_order between 1 and 20),
  -- Null means "expires when the event's sales close".
  expires_at timestamptz,
  created_by uuid references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index affiliate_links_event on public.affiliate_links (event_id);
create trigger affiliate_links_touch before update on public.affiliate_links
  for each row execute function public.touch_updated_at();

-- ---------------------------------------------------------------------------
-- Commerce
-- ---------------------------------------------------------------------------
create table public.reservations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.profiles (id),
  ticket_type_id uuid not null references public.ticket_types (id),
  quantity integer not null check (quantity > 0),
  route public.purchase_route not null,
  affiliate_link_id uuid references public.affiliate_links (id),
  status public.reservation_status not null default 'active',
  expires_at timestamptz not null,
  created_at timestamptz not null default now(),
  closed_at timestamptz,
  check (route <> 'affiliate' or affiliate_link_id is not null)
);
create index reservations_active_expiry on public.reservations (expires_at) where status = 'active';

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  ref text not null unique,
  user_id uuid not null references public.profiles (id),
  event_id uuid not null references public.events (id),
  ticket_type_id uuid not null references public.ticket_types (id),
  reservation_id uuid not null unique references public.reservations (id),
  route public.purchase_route not null,
  affiliate_link_id uuid references public.affiliate_links (id),
  status public.order_status not null default 'pending_payment',
  currency text not null default 'gbp' check (currency = 'gbp'),
  -- Immutable commercial snapshot taken when the order is created.
  ticket_type_name text not null,
  quantity integer not null check (quantity > 0),
  unit_price_pence integer not null check (unit_price_pence >= 0),
  unit_fee_pence integer not null check (unit_fee_pence >= 0),
  subtotal_pence integer not null,
  fee_total_pence integer not null,
  total_pence integer not null,
  refunded_pence integer not null default 0 check (refunded_pence >= 0),
  marketing_channel text,
  stripe_checkout_session_id text unique,
  stripe_payment_intent_id text unique,
  paid_at timestamptz,
  exception_reason text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (subtotal_pence = unit_price_pence * quantity),
  check (fee_total_pence = unit_fee_pence * quantity),
  check (total_pence = subtotal_pence + fee_total_pence),
  check (refunded_pence <= total_pence)
);
create index orders_user on public.orders (user_id, created_at desc);
create index orders_event on public.orders (event_id);
create trigger orders_touch before update on public.orders
  for each row execute function public.touch_updated_at();

create table public.tickets (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  event_id uuid not null references public.events (id),
  ticket_type_id uuid not null references public.ticket_types (id),
  user_id uuid not null references public.profiles (id),
  status public.ticket_status not null default 'valid',
  holder_first_name text,
  holder_last_name text,
  issued_at timestamptz not null default now(),
  revoked_at timestamptz,
  revoked_reason text,
  check ((status = 'revoked') = (revoked_at is not null))
);
create index tickets_user on public.tickets (user_id);
create index tickets_event_status on public.tickets (event_id, status);

-- Barcodes live in their own table so RLS can hide them until the reveal.
-- Rows are never updated or deleted, so a code can never be reissued.
create table public.ticket_barcodes (
  ticket_id uuid primary key references public.tickets (id),
  barcode text not null unique check (barcode ~ '^[A-HJ-NP-Z2-9]{12}$'),
  created_at timestamptz not null default now()
);
create or replace function public.forbid_change() returns trigger
language plpgsql as $$
begin
  raise exception '% rows are immutable', tg_table_name using errcode = '42501';
end $$;
create trigger ticket_barcodes_immutable before update or delete on public.ticket_barcodes
  for each row execute function public.forbid_change();

create table public.refunds (
  id uuid primary key default gen_random_uuid(),
  order_id uuid not null references public.orders (id),
  amount_pence integer not null check (amount_pence > 0),
  reason text not null,
  stripe_refund_id text unique,
  actor uuid references public.profiles (id),
  created_at timestamptz not null default now()
);

create table public.waitlist_entries (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  status text not null default 'active' check (status in ('active', 'notified', 'expired')),
  created_at timestamptz not null default now(),
  unique (event_id, user_id)
);

-- ---------------------------------------------------------------------------
-- Venue close-off reports (one standard CSV format, docs/08 section 5a)
-- ---------------------------------------------------------------------------
create table public.closeoff_reports (
  id uuid primary key default gen_random_uuid(),
  event_id uuid not null references public.events (id),
  version integer not null check (version > 0),
  kind public.closeoff_kind not null,
  -- The scheduled slot this report belongs to. A repeated trigger for the same slot is a no-op.
  slot_at timestamptz not null,
  generated_at timestamptz not null default now(),
  row_count integer not null,
  valid_total integer not null,
  added_count integer not null,
  revoked_count integer not null,
  csv text not null,
  sha256 text not null,
  recipients text[] not null default '{}',
  delivery_status public.delivery_status not null default 'pending',
  delivered_at timestamptz,
  delivery_error text,
  resend_message_id text,
  acknowledged_at timestamptz,
  acknowledged_by uuid references public.profiles (id),
  acknowledgement_note text,
  unique (event_id, version),
  unique (event_id, kind, slot_at)
);

create table public.closeoff_report_items (
  report_id uuid not null references public.closeoff_reports (id) on delete cascade,
  ticket_id uuid not null references public.tickets (id),
  status public.ticket_status not null,
  primary key (report_id, ticket_id)
);

-- ---------------------------------------------------------------------------
-- Integration plumbing
-- ---------------------------------------------------------------------------
-- Every webhook event is recorded once; a duplicate delivery hits the unique key and is skipped.
create table public.provider_events (
  id bigint generated always as identity primary key,
  provider text not null check (provider in ('stripe', 'apple', 'resend')),
  event_id text not null,
  event_type text not null,
  received_at timestamptz not null default now(),
  processed_at timestamptz,
  error text,
  unique (provider, event_id)
);

-- Transactional email outbox. A dedupe key stops the same email going twice.
create table public.email_outbox (
  id uuid primary key default gen_random_uuid(),
  template text not null,
  to_email text not null,
  user_id uuid references public.profiles (id) on delete set null,
  payload jsonb not null default '{}',
  dedupe_key text not null unique,
  status public.outbox_status not null default 'queued',
  attempts integer not null default 0,
  send_after timestamptz not null default now(),
  resend_message_id text,
  last_error text,
  created_at timestamptz not null default now(),
  sent_at timestamptz
);
create index email_outbox_due on public.email_outbox (send_after) where status = 'queued';

create table public.audit_events (
  id bigint generated always as identity primary key,
  actor uuid,
  action text not null,
  subject_type text not null,
  subject_id text,
  detail jsonb not null default '{}',
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Affiliate attribution (Nathan, 4 Nov 2026): partner links skip the paywall,
-- and every visit, sign-up and finished sale is attributed to the link and partner.
-- ---------------------------------------------------------------------------
alter table public.profiles
  add column acquired_via_link_id uuid references public.affiliate_links (id),
  add column acquired_via_partner_id uuid references public.partners (id),
  add column acquired_at timestamptz;

create table public.affiliate_link_visits (
  id bigint generated always as identity primary key,
  link_id uuid not null references public.affiliate_links (id) on delete cascade,
  visitor_id text not null,            -- random first-party id from the browser, not a fingerprint
  user_id uuid references public.profiles (id) on delete set null,
  landed_at timestamptz not null default now(),
  referrer_host text,
  utm_source text,
  utm_medium text,
  utm_campaign text
);
create index affiliate_link_visits_link on public.affiliate_link_visits (link_id, landed_at);
