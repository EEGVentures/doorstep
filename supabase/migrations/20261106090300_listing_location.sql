-- Close-to-home discovery (4 Nov 2026): listings expose the venue's coordinates so the app can show
-- "12 min walk" and hide nights far from the customer's area. Columns are appended, so the view keeps its shape.
create or replace view public.event_listings with (security_invoker = true) as
select
  e.id, e.slug, e.title, e.description, e.image_url, e.category, e.promoter_name,
  e.starts_at, e.doors_at, e.sales_close_at, e.status,
  v.id as venue_id, v.name as venue_name, v.city as venue_city, v.address_line as venue_address, v.postcode as venue_postcode, v.timezone,
  (select min(t.price_pence + t.fee_pence) from public.ticket_types t where t.event_id = e.id and t.active) as from_price_pence,
  (select coalesce(sum(greatest(t.capacity - t.sold - t.held, 0)), 0) from public.ticket_types t where t.event_id = e.id and t.active) as tickets_left,
  v.lat as venue_lat, v.lng as venue_lng
from public.events e
join public.venues v on v.id = e.venue_id
where e.status <> 'draft' and e.visibility = 'public';
grant select on public.event_listings to anon, authenticated;
