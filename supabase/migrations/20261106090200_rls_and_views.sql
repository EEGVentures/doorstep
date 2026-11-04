-- Row-level security. Default deny: a table without a policy is server-only (service_role bypasses RLS).

alter table public.profiles enable row level security;
alter table public.consent_events enable row level security;
alter table public.membership_entitlements enable row level security;
alter table public.venues enable row level security;
alter table public.venue_closeoff_settings enable row level security;
alter table public.events enable row level security;
alter table public.ticket_types enable row level security;
alter table public.partners enable row level security;
alter table public.affiliate_links enable row level security;
alter table public.affiliate_link_visits enable row level security;
alter table public.reservations enable row level security;
alter table public.orders enable row level security;
alter table public.tickets enable row level security;
alter table public.ticket_barcodes enable row level security;
alter table public.refunds enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.closeoff_reports enable row level security;
alter table public.closeoff_report_items enable row level security;
alter table public.provider_events enable row level security;
alter table public.email_outbox enable row level security;
alter table public.audit_events enable row level security;

-- Profiles: read your own; update only harmless fields (role and Stripe ids are server-only).
create policy profiles_self_read on public.profiles for select to authenticated using (id = auth.uid());
create policy profiles_staff_read on public.profiles for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy profiles_self_update on public.profiles for update to authenticated using (id = auth.uid()) with check (id = auth.uid());
revoke update on public.profiles from authenticated, anon;
grant update (first_name, last_name, home_city, home_postcode) on public.profiles to authenticated;

create policy consent_self_read on public.consent_events for select to authenticated using (user_id = auth.uid());

create policy membership_self_read on public.membership_entitlements for select to authenticated using (user_id = auth.uid());

-- Public catalogue.
create policy venues_public_read on public.venues for select to anon, authenticated using (true);
create policy events_public_read on public.events for select to anon, authenticated
  using (status <> 'draft' and (visibility = 'public' or public.current_role_is('ops', 'admin')));
create policy events_staff_read on public.events for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy ticket_types_public_read on public.ticket_types for select to anon, authenticated
  using (active and exists (select 1 from public.events e where e.id = event_id and e.status <> 'draft'));

-- Customer's own commerce records.
create policy orders_self_read on public.orders for select to authenticated using (user_id = auth.uid());
create policy tickets_self_read on public.tickets for select to authenticated using (user_id = auth.uid());

-- The reveal rule, enforced in the database: a buyer can read a barcode only for their own
-- valid ticket, from 48 hours before doors. Staff can always read.
create policy barcodes_owner_after_reveal on public.ticket_barcodes for select to authenticated using (
  exists (
    select 1 from public.tickets t join public.events e on e.id = t.event_id
    where t.id = ticket_id and t.user_id = auth.uid() and t.status = 'valid'
      and now() >= e.doors_at - public.reveal_lead()
  )
);
create policy barcodes_staff_read on public.ticket_barcodes for select to authenticated using (public.current_role_is('admin'));

create policy waitlist_self_read on public.waitlist_entries for select to authenticated using (user_id = auth.uid());
create policy waitlist_self_insert on public.waitlist_entries for insert to authenticated with check (user_id = auth.uid());
create policy waitlist_self_delete on public.waitlist_entries for delete to authenticated using (user_id = auth.uid());

-- Staff read access for the operations dashboard (writes go through the server API).
create policy closeoff_staff_read on public.closeoff_reports for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy partners_staff_read on public.partners for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy affiliate_links_staff_read on public.affiliate_links for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy reservations_staff_read on public.reservations for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy orders_staff_read on public.orders for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy tickets_staff_read on public.tickets for select to authenticated using (public.current_role_is('ops', 'admin'));
create policy audit_admin_read on public.audit_events for select to authenticated using (public.current_role_is('admin'));

-- Public event listing with live availability (no stock internals beyond "tickets left").
create or replace view public.event_listings with (security_invoker = true) as
select
  e.id, e.slug, e.title, e.description, e.image_url, e.category, e.promoter_name,
  e.starts_at, e.doors_at, e.sales_close_at, e.status,
  v.id as venue_id, v.name as venue_name, v.city as venue_city, v.address_line as venue_address, v.postcode as venue_postcode, v.timezone,
  (select min(t.price_pence + t.fee_pence) from public.ticket_types t where t.event_id = e.id and t.active) as from_price_pence,
  (select coalesce(sum(greatest(t.capacity - t.sold - t.held, 0)), 0) from public.ticket_types t where t.event_id = e.id and t.active) as tickets_left
from public.events e
join public.venues v on v.id = e.venue_id
where e.status <> 'draft' and e.visibility = 'public';
grant select on public.event_listings to anon, authenticated;

-- Wallet view: the customer's tickets with event details and reveal time. Barcode joins only when RLS allows.
create or replace view public.my_tickets with (security_invoker = true) as
select
  t.id, t.status, t.order_id, o.ref as order_ref, t.issued_at,
  t.holder_first_name, t.holder_last_name,
  tt.name as ticket_type,
  e.id as event_id, e.slug as event_slug, e.title as event_title, e.image_url, e.starts_at, e.doors_at,
  e.doors_at - public.reveal_lead() as reveal_at,
  v.name as venue_name, v.city as venue_city, v.address_line as venue_address, v.postcode as venue_postcode, v.timezone,
  b.barcode
from public.tickets t
join public.orders o on o.id = t.order_id
join public.ticket_types tt on tt.id = t.ticket_type_id
join public.events e on e.id = t.event_id
join public.venues v on v.id = e.venue_id
left join public.ticket_barcodes b on b.ticket_id = t.id
where t.user_id = auth.uid();
grant select on public.my_tickets to authenticated;

-- Affiliate performance for the operations dashboard: visits, sign-ups, finished sales, revenue.
create or replace view public.affiliate_link_stats with (security_invoker = true) as
select
  l.id as link_id, l.code, l.status, p.id as partner_id, p.name as partner_name,
  e.id as event_id, e.title as event_title,
  (select count(*) from public.affiliate_link_visits v where v.link_id = l.id) as visits,
  (select count(distinct v.visitor_id) from public.affiliate_link_visits v where v.link_id = l.id) as unique_visitors,
  (select count(*) from public.profiles pr where pr.acquired_via_link_id = l.id) as signups,
  (select count(*) from public.orders o where o.affiliate_link_id = l.id and o.status in ('paid', 'partially_refunded')) as paid_orders,
  (select coalesce(sum(o.quantity), 0) from public.orders o where o.affiliate_link_id = l.id and o.status in ('paid', 'partially_refunded')) as tickets_sold,
  (select coalesce(sum(o.total_pence - o.refunded_pence), 0) from public.orders o where o.affiliate_link_id = l.id and o.status in ('paid', 'partially_refunded')) as net_revenue_pence,
  (select count(*) from public.profiles pr where pr.acquired_via_link_id = l.id and pr.marketing_email_consent) as marketing_optins,
  (select count(distinct m.user_id) from public.membership_entitlements m join public.profiles pr on pr.id = m.user_id
     where pr.acquired_via_link_id = l.id) as converted_to_members
from public.affiliate_links l
join public.partners p on p.id = l.partner_id
join public.events e on e.id = l.event_id;
grant select on public.affiliate_link_stats to authenticated;

-- First-touch attribution: called by the server when someone signs up (or first buys) after landing on a link.
create or replace function public.attribute_user_to_link(p_user uuid, p_link uuid, p_visitor text)
returns void
language plpgsql volatile security definer set search_path = public as $$
begin
  update public.profiles p
     set acquired_via_link_id = p_link,
         acquired_via_partner_id = (select partner_id from public.affiliate_links where id = p_link),
         acquired_at = now()
   where p.id = p_user and p.acquired_via_link_id is null;
  if p_visitor is not null then
    update public.affiliate_link_visits set user_id = p_user
     where link_id = p_link and visitor_id = p_visitor and user_id is null;
  end if;
end $$;
revoke execute on function public.attribute_user_to_link(uuid, uuid, text) from public, anon, authenticated;
grant execute on function public.attribute_user_to_link(uuid, uuid, text) to service_role;

-- Partner sales ledger (Nathan, 4 Nov 2026): accurate reporting back to affiliates and partners.
-- One row per order bought through a partner link, with refunds netted off. No customer
-- personal data, so a statement can be shared with the partner as it is.
create or replace view public.partner_sales_ledger with (security_invoker = true) as
select
  p.id as partner_id, p.name as partner_name,
  l.id as link_id, l.code as link_code,
  e.id as event_id, e.title as event_title, e.starts_at as event_starts_at, v.name as venue_name,
  o.ref as order_ref, o.status as order_status, o.paid_at,
  o.ticket_type_name, o.quantity,
  (select count(*) from public.tickets t where t.order_id = o.id and t.status = 'valid') as tickets_valid,
  o.subtotal_pence, o.fee_total_pence, o.total_pence, o.refunded_pence,
  o.total_pence - o.refunded_pence as net_pence,
  (pr.acquired_via_link_id = l.id) as new_customer_via_link
from public.orders o
join public.affiliate_links l on l.id = o.affiliate_link_id
join public.partners p on p.id = l.partner_id
join public.events e on e.id = o.event_id
join public.venues v on v.id = e.venue_id
join public.profiles pr on pr.id = o.user_id
where o.route = 'affiliate' and o.paid_at is not null;
grant select on public.partner_sales_ledger to authenticated;
