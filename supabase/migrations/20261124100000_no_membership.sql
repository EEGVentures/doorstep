-- No paid membership (Nathan, 24 Nov 2026). Too many gateways were adding drop-off, so the only
-- transaction is buying a ticket. Browsing is free; a (free) account is needed to buy; partner
-- links stay for tracking and a per-partner welcome. Prices show only to signed-in customers, so
-- promoters' released seats stay discreet and off search engines (flip prices_public() to change).

-- 1. Purchase routes: 'direct' for any signed-in customer. 'member' stays in the enum, unused.
alter type public.purchase_route add value if not exists 'direct';

-- 2. Checkout no longer asks for a membership. An event-specific partner link still marks the
--    order as 'affiliate' (tracking, the link's own per-order limit); everyone else buys 'direct'.
create or replace function public.create_reservation(
  p_user uuid,
  p_ticket_type uuid,
  p_quantity int,
  p_affiliate_code text default null,
  p_hold interval default interval '35 minutes'
) returns public.orders
language plpgsql volatile security definer set search_path = public as $$
declare
  tt public.ticket_types;
  ev public.events;
  link public.affiliate_links;
  v_route public.purchase_route;
  v_max int;
  res public.reservations;
  ord public.orders;
  updated int;
begin
  if p_quantity is null or p_quantity < 1 then
    raise exception 'DS_BAD_QUANTITY';
  end if;

  select * into tt from public.ticket_types where id = p_ticket_type;
  if not found or not tt.active then raise exception 'DS_TICKET_TYPE_NOT_FOUND'; end if;
  select * into ev from public.events where id = tt.event_id;
  if ev.status <> 'on_sale' then raise exception 'DS_NOT_ON_SALE'; end if;
  if now() >= coalesce(ev.sales_close_at, ev.starts_at) then raise exception 'DS_SALES_CLOSED'; end if;

  if p_affiliate_code is not null and length(trim(p_affiliate_code)) > 0 then
    link := public.valid_affiliate_link(p_affiliate_code, ev.id);
    if link.id is null then raise exception 'DS_AFFILIATE_INVALID'; end if;
    v_route := 'affiliate';
    v_max := least(tt.max_per_order, link.max_per_order);
  else
    v_route := 'direct';
    v_max := tt.max_per_order;
  end if;

  if p_quantity > v_max then raise exception 'DS_TOO_MANY'; end if;

  -- One checkout per account per event: a new hold replaces any earlier hold on the same event.
  perform public.release_reservation(r.id, 'cancelled')
  from public.reservations r join public.ticket_types x on x.id = r.ticket_type_id
  where r.user_id = p_user and x.event_id = ev.id and r.status = 'active';

  -- Anti-hoarding (security review, 24 Nov 2026): an account can hold stock for at most 3 events at once,
  -- so a scripted account cannot lock up a night while sign-up needs no email confirmation.
  if (select count(*) from public.reservations r where r.user_id = p_user and r.status = 'active' and r.expires_at > now()) >= 3 then
    raise exception 'DS_HOLD_LIMIT';
  end if;

  update public.ticket_types
     set held = held + p_quantity
   where id = tt.id and capacity - sold - held >= p_quantity;
  get diagnostics updated = row_count;
  if updated = 0 then raise exception 'DS_SOLD_OUT'; end if;

  insert into public.reservations (user_id, ticket_type_id, quantity, route, affiliate_link_id, expires_at)
  values (p_user, tt.id, p_quantity, v_route, link.id, now() + p_hold)
  returning * into res;

  insert into public.orders (
    ref, user_id, event_id, ticket_type_id, reservation_id, route, affiliate_link_id,
    ticket_type_name, quantity, unit_price_pence, unit_fee_pence,
    subtotal_pence, fee_total_pence, total_pence
  ) values (
    public.generate_order_ref(), p_user, ev.id, tt.id, res.id, v_route, link.id,
    tt.name, p_quantity, tt.price_pence, tt.fee_pence,
    tt.price_pence * p_quantity, tt.fee_pence * p_quantity, (tt.price_pence + tt.fee_pence) * p_quantity
  ) returning * into ord;

  return ord;
end $$;
revoke execute on function public.create_reservation(uuid, uuid, int, text, interval) from public, anon, authenticated;
grant execute on function public.create_reservation(uuid, uuid, int, text, interval) to service_role;

-- 3. Partner stats without the membership conversion column.
drop view if exists public.affiliate_link_stats;
create view public.affiliate_link_stats with (security_invoker = true) as
select
  l.id as link_id, l.code, l.status, p.id as partner_id, p.name as partner_name,
  e.id as event_id, e.title as event_title,
  (select count(*) from public.affiliate_link_visits v where v.link_id = l.id) as visits,
  (select count(distinct v.visitor_id) from public.affiliate_link_visits v where v.link_id = l.id) as unique_visitors,
  (select count(*) from public.profiles pr where pr.acquired_via_link_id = l.id) as signups,
  (select count(*) from public.orders o where o.affiliate_link_id = l.id and o.status in ('paid', 'partially_refunded')) as paid_orders,
  (select coalesce(sum(o.quantity), 0) from public.orders o where o.affiliate_link_id = l.id and o.status in ('paid', 'partially_refunded')) as tickets_sold,
  (select coalesce(sum(o.total_pence - o.refunded_pence), 0) from public.orders o where o.affiliate_link_id = l.id and o.status in ('paid', 'partially_refunded')) as net_revenue_pence,
  (select count(*) from public.profiles pr where pr.acquired_via_link_id = l.id and pr.marketing_email_consent) as marketing_optins
from public.affiliate_links l
join public.partners p on p.id = l.partner_id
join public.events e on e.id = l.event_id;
grant select on public.affiliate_link_stats to authenticated, service_role;

-- 4. Membership storage goes.
drop function if exists public.has_active_membership(uuid);
drop table if exists public.membership_entitlements;
drop type if exists public.membership_status;
drop type if exists public.membership_source;

-- 5. Per-partner welcome on /go links, e.g. "Thank you to our Blue Light services!" (Nathan, 5 Nov 2026).
alter table public.partners add column if not exists welcome_title text;
alter table public.partners add column if not exists welcome_line text;

-- 6. Prices for signed-in customers only. Guests can read ticket types without the price columns;
--    listings carry a price only when someone is signed in.
create or replace function public.prices_public() returns boolean language sql immutable as $$ select false $$;

revoke select on public.ticket_types from anon;
grant select (id, event_id, name, capacity, sold, held, max_per_order, sort_order, active, created_at, updated_at)
  on public.ticket_types to anon;

create or replace function public.listing_from_price(p_event uuid) returns integer
language sql stable security definer set search_path = public as $$
  select case when public.prices_public() or auth.uid() is not null then
    (select min(t.price_pence + t.fee_pence) from public.ticket_types t where t.event_id = p_event and t.active)
  end
$$;
revoke execute on function public.listing_from_price(uuid) from public;
grant execute on function public.listing_from_price(uuid) to anon, authenticated, service_role;
grant execute on function public.prices_public() to anon, authenticated, service_role;

create or replace view public.event_listings with (security_invoker = true) as
select
  e.id, e.slug, e.title, e.description, e.image_url, e.category, e.promoter_name,
  e.starts_at, e.doors_at, e.sales_close_at, e.status,
  v.id as venue_id, v.name as venue_name, v.city as venue_city, v.address_line as venue_address, v.postcode as venue_postcode, v.timezone,
  public.listing_from_price(e.id) as from_price_pence,
  (select coalesce(sum(greatest(t.capacity - t.sold - t.held, 0)), 0) from public.ticket_types t where t.event_id = e.id and t.active) as tickets_left,
  v.lat as venue_lat, v.lng as venue_lng, e.house_favourite
from public.events e
join public.venues v on v.id = e.venue_id
where e.status <> 'draft' and e.visibility = 'public';
grant select on public.event_listings to anon, authenticated;
