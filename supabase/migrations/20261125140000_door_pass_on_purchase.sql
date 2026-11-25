-- Door passes on purchase (Nathan, 25 Nov 2026): the buyer sees their code as soon as the
-- order is paid, not 48 hours before doors. Replaces the 48-hour reveal rule.
-- Still enforced here: a buyer reads codes only for their own valid tickets (a refunded or
-- revoked ticket hides its code at once). Staff can always read.
drop policy if exists barcodes_owner_after_reveal on public.ticket_barcodes;
create policy barcodes_owner_valid on public.ticket_barcodes for select to authenticated using (
  exists (
    select 1 from public.tickets t
    where t.id = ticket_id and t.user_id = auth.uid() and t.status = 'valid'
  )
);

-- Wallet view keeps its shape; reveal_at is now the moment the ticket was issued.
create or replace view public.my_tickets with (security_invoker = true) as
select
  t.id, t.status, t.order_id, o.ref as order_ref, t.issued_at,
  t.holder_first_name, t.holder_last_name,
  tt.name as ticket_type,
  e.id as event_id, e.slug as event_slug, e.title as event_title, e.image_url, e.starts_at, e.doors_at,
  t.issued_at as reveal_at,
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

-- The reveal interval is no longer used anywhere.
revoke execute on function public.reveal_lead() from anon, authenticated;
drop function public.reveal_lead();
