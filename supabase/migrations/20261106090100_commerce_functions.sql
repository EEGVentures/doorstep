-- Commerce functions. All run as SECURITY DEFINER and are callable only by the server (service_role).

-- 12 characters from A-Z and 2-9 without lookalikes (no I, O, 0, 1). 32 symbols, so byte & 31 is unbiased.
create or replace function public.generate_barcode() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(12);
  out text := '';
  i int;
begin
  for i in 0..11 loop
    out := out || substr(alphabet, (get_byte(bytes, i) & 31) + 1, 1);
  end loop;
  return out;
end $$;

-- Human-friendly order reference, e.g. DS-7KQ2MX. Random, unique, not guessable in sequence.
create or replace function public.generate_order_ref() returns text
language plpgsql volatile set search_path = public, extensions as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea;
  out text;
  i int;
begin
  loop
    bytes := extensions.gen_random_bytes(6);
    out := 'DS-';
    for i in 0..5 loop
      out := out || substr(alphabet, (get_byte(bytes, i) & 31) + 1, 1);
    end loop;
    exit when not exists (select 1 from public.orders where ref = out);
  end loop;
  return out;
end $$;

-- Returns the affiliate link row if the code is valid for this event right now, else null.
create or replace function public.valid_affiliate_link(p_code text, p_event uuid)
returns public.affiliate_links
language sql stable security definer set search_path = public as $$
  select l.*
  from public.affiliate_links l
  join public.partners p on p.id = l.partner_id
  join public.events e on e.id = l.event_id
  where l.code = upper(trim(p_code))
    and l.event_id = p_event
    and l.status = 'active'
    and p.status = 'approved'
    and now() < coalesce(l.expires_at, e.sales_close_at, e.starts_at)
$$;

-- Step 1 of checkout: check the purchase is allowed and hold stock atomically.
-- Raises with a stable error code in the message (DS_*), which the API maps to a friendly message.
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

  -- Membership gate. An event-specific affiliate link is the only exception.
  if p_affiliate_code is not null and length(trim(p_affiliate_code)) > 0 then
    link := public.valid_affiliate_link(p_affiliate_code, ev.id);
    if link.id is null then raise exception 'DS_AFFILIATE_INVALID'; end if;
    v_route := 'affiliate';
    v_max := least(tt.max_per_order, link.max_per_order);
  elsif public.has_active_membership(p_user) then
    v_route := 'member';
    v_max := tt.max_per_order;
  else
    raise exception 'DS_MEMBERSHIP_REQUIRED';
  end if;

  if p_quantity > v_max then raise exception 'DS_TOO_MANY'; end if;

  -- One open checkout per person per ticket type: cancel any earlier active hold first.
  perform public.release_reservation(r.id, 'cancelled')
  from public.reservations r
  where r.user_id = p_user and r.ticket_type_id = tt.id and r.status = 'active';

  -- Conditional update: only succeeds if enough stock is left. Concurrent buyers serialise on this row.
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

-- Release a hold (expired or cancelled). Safe to call twice: only an active hold releases stock.
create or replace function public.release_reservation(p_reservation uuid, p_status public.reservation_status)
returns boolean
language plpgsql volatile security definer set search_path = public as $$
declare
  res public.reservations;
begin
  if p_status not in ('expired', 'cancelled') then raise exception 'DS_BAD_STATUS'; end if;
  update public.reservations
     set status = p_status, closed_at = now()
   where id = p_reservation and status = 'active'
  returning * into res;
  if not found then return false; end if;

  update public.ticket_types set held = held - res.quantity where id = res.ticket_type_id;
  update public.orders
     set status = case when p_status = 'expired' then 'expired'::public.order_status else 'cancelled'::public.order_status end
   where reservation_id = res.id and status = 'pending_payment';
  return true;
end $$;

-- Cron sweep for holds whose time is up.
create or replace function public.expire_stale_reservations() returns int
language plpgsql volatile security definer set search_path = public as $$
declare
  n int := 0;
  r record;
begin
  for r in select id from public.reservations where status = 'active' and expires_at <= now() for update skip locked loop
    if public.release_reservation(r.id, 'expired') then n := n + 1; end if;
  end loop;
  return n;
end $$;

-- Step 3 of checkout: a verified Stripe event says the order is paid. Idempotent.
-- Normal case: consume the hold and issue tickets with fresh random barcodes.
-- Late payment after the hold expired: re-claim stock if any is left, else mark the order
-- as an exception for a refund (never oversell).
create or replace function public.fulfil_order(
  p_order uuid,
  p_payment_intent text,
  p_amount_pence int
) returns public.orders
language plpgsql volatile security definer set search_path = public as $$
declare
  ord public.orders;
  res public.reservations;
  prof public.profiles;
  updated int;
  t_id uuid;
  i int;
  attempt int;
begin
  select * into ord from public.orders where id = p_order for update;
  if not found then raise exception 'DS_ORDER_NOT_FOUND'; end if;
  if ord.status in ('paid', 'refunded', 'partially_refunded', 'exception') then
    return ord; -- already handled
  end if;

  if p_amount_pence is distinct from ord.total_pence then
    update public.orders set status = 'exception', stripe_payment_intent_id = p_payment_intent,
      exception_reason = format('Amount mismatch: paid %s, expected %s', p_amount_pence, ord.total_pence)
    where id = ord.id returning * into ord;
    return ord;
  end if;

  select * into res from public.reservations where id = ord.reservation_id for update;

  if res.status = 'active' then
    update public.reservations set status = 'consumed', closed_at = now() where id = res.id;
    update public.ticket_types set held = held - res.quantity, sold = sold + res.quantity where id = res.ticket_type_id;
  else
    -- Late payment: try to take stock again.
    update public.ticket_types set sold = sold + ord.quantity
     where id = ord.ticket_type_id and capacity - sold - held >= ord.quantity;
    get diagnostics updated = row_count;
    if updated = 0 then
      update public.orders set status = 'exception', stripe_payment_intent_id = p_payment_intent,
        exception_reason = 'Paid after the hold expired and the stock had gone. Refund needed.'
      where id = ord.id returning * into ord;
      return ord;
    end if;
    update public.reservations set status = 'consumed', closed_at = coalesce(closed_at, now()) where id = res.id;
  end if;

  select * into prof from public.profiles where id = ord.user_id;

  for i in 1..ord.quantity loop
    insert into public.tickets (order_id, event_id, ticket_type_id, user_id, holder_first_name, holder_last_name)
    values (ord.id, ord.event_id, ord.ticket_type_id, ord.user_id, prof.first_name, prof.last_name)
    returning id into t_id;
    attempt := 0;
    loop
      begin
        insert into public.ticket_barcodes (ticket_id, barcode) values (t_id, public.generate_barcode());
        exit;
      exception when unique_violation then
        attempt := attempt + 1;
        if attempt > 5 then raise; end if;
      end;
    end loop;
  end loop;

  update public.orders
     set status = 'paid', paid_at = now(), stripe_payment_intent_id = p_payment_intent, exception_reason = null
   where id = ord.id returning * into ord;

  -- Sold out flag for the listing.
  update public.events e set status = 'sold_out'
   where e.id = ord.event_id and e.status = 'on_sale'
     and not exists (select 1 from public.ticket_types t where t.event_id = e.id and t.active and t.capacity - t.sold - t.held > 0);

  return ord;
end $$;

-- Refund path: revoke the order's tickets (their codes are never reused) and return stock.
-- Full refunds only in v1; a partial refund is recorded but leaves tickets valid.
create or replace function public.record_refund(
  p_order uuid,
  p_amount_pence int,
  p_reason text,
  p_stripe_refund_id text,
  p_actor uuid default null
) returns public.orders
language plpgsql volatile security definer set search_path = public as $$
declare
  ord public.orders;
  n int;
begin
  select * into ord from public.orders where id = p_order for update;
  if not found then raise exception 'DS_ORDER_NOT_FOUND'; end if;

  if p_stripe_refund_id is not null and exists (select 1 from public.refunds where stripe_refund_id = p_stripe_refund_id) then
    return ord; -- already recorded
  end if;
  if ord.refunded_pence + p_amount_pence > ord.total_pence then raise exception 'DS_REFUND_TOO_LARGE'; end if;

  insert into public.refunds (order_id, amount_pence, reason, stripe_refund_id, actor)
  values (ord.id, p_amount_pence, p_reason, p_stripe_refund_id, p_actor);

  if ord.refunded_pence + p_amount_pence = ord.total_pence then
    update public.tickets set status = 'revoked', revoked_at = now(), revoked_reason = p_reason
     where order_id = ord.id and status = 'valid';
    get diagnostics n = row_count;
    if n > 0 then
      update public.ticket_types set sold = sold - n where id = ord.ticket_type_id;
      update public.events set status = 'on_sale' where id = ord.event_id and status = 'sold_out';
    end if;
    update public.orders set status = 'refunded', refunded_pence = total_pence where id = ord.id returning * into ord;
  else
    update public.orders set status = 'partially_refunded', refunded_pence = refunded_pence + p_amount_pence
     where id = ord.id returning * into ord;
  end if;

  insert into public.audit_events (actor, action, subject_type, subject_id, detail)
  values (p_actor, 'order.refund', 'order', ord.id::text,
          jsonb_build_object('amount_pence', p_amount_pence, 'reason', p_reason, 'stripe_refund_id', p_stripe_refund_id));
  return ord;
end $$;

-- Lock down: these are server-only.
revoke execute on function public.create_reservation(uuid, uuid, int, text, interval) from public, anon, authenticated;
revoke execute on function public.release_reservation(uuid, public.reservation_status) from public, anon, authenticated;
revoke execute on function public.expire_stale_reservations() from public, anon, authenticated;
revoke execute on function public.fulfil_order(uuid, text, int) from public, anon, authenticated;
revoke execute on function public.record_refund(uuid, int, text, text, uuid) from public, anon, authenticated;
revoke execute on function public.generate_barcode() from public, anon, authenticated;
revoke execute on function public.generate_order_ref() from public, anon, authenticated;
revoke execute on function public.valid_affiliate_link(text, uuid) from public, anon, authenticated;
grant execute on function public.create_reservation(uuid, uuid, int, text, interval) to service_role;
grant execute on function public.release_reservation(uuid, public.reservation_status) to service_role;
grant execute on function public.expire_stale_reservations() to service_role;
grant execute on function public.fulfil_order(uuid, text, int) to service_role;
grant execute on function public.record_refund(uuid, int, text, text, uuid) to service_role;
grant execute on function public.generate_barcode() to service_role;
grant execute on function public.generate_order_ref() to service_role;
grant execute on function public.valid_affiliate_link(text, uuid) to service_role;
