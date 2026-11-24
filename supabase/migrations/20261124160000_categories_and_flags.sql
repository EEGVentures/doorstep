-- Event categories and flag banners (Nathan, 24 Nov 2026, features inspired by seat-filler sites).
-- 1. A fixed category list so What's on can be filtered.
-- 2. A flag per event ("New", "Selling fast", "Last few"), worked out from the listing date and the stock left,
--    with a manual override for staff.

-- 1. Categories. Old free-text values are mapped onto the list, then the list is enforced.
update public.events set category = case
  when category is null then null
  when lower(category) in ('gig', 'gigs', 'music', 'live music') then 'Music'
  when lower(category) in ('jazz', 'blues', 'jazz & blues') then 'Jazz & Blues'
  when lower(category) in ('club night', 'club nights', 'clubbing') then 'Club nights'
  when lower(category) in ('quiz night', 'quiz', 'quiz & games') then 'Quiz & games'
  when lower(category) in ('ballet', 'opera', 'ballet & opera', 'dance') then 'Ballet & Opera'
  when lower(category) in ('theatre', 'musical', 'musicals') then 'Theatre'
  when lower(category) in ('comedy', 'stand-up') then 'Comedy'
  when lower(category) in ('classical', 'orchestra') then 'Classical'
  when lower(category) in ('family', 'kids') then 'Family'
  when lower(category) in ('talk', 'talks', 'spoken word') then 'Talks'
  else 'Music' end;

alter table public.events add constraint events_category_known check (category is null or category in (
  'Theatre', 'Music', 'Comedy', 'Ballet & Opera', 'Classical', 'Jazz & Blues', 'Club nights', 'Quiz & games', 'Family', 'Talks'
));

-- 2. Flags. listed_at drives "New"; flag_override lets staff force a flag ('none' hides any flag).
alter table public.events add column listed_at timestamptz not null default now();
update public.events set listed_at = created_at;
alter table public.events add column flag_override text check (flag_override in ('new', 'selling_fast', 'last_few', 'none'));

-- The rules, in one place. Sold out shows no flag (the tile already says Sold out).
--   last_few:     10 or fewer tickets left, or under 10% of capacity left
--   selling_fast: 60% or more of capacity sold or on hold
--   new:          listed in the last 7 days
create or replace function public.event_flag(p_status public.event_status, p_listed_at timestamptz, p_override text,
                                              p_capacity bigint, p_left bigint)
returns text
language sql stable set search_path = public as $$
  select case
    when p_status = 'sold_out' or coalesce(p_left, 0) <= 0 then null
    when p_override = 'none' then null
    when p_override is not null then p_override
    when p_left <= 10 or p_left * 10 < p_capacity then 'last_few'
    when (p_capacity - p_left) * 10 >= p_capacity * 6 then 'selling_fast'
    when p_listed_at > now() - interval '7 days' then 'new'
  end
$$;
grant execute on function public.event_flag(public.event_status, timestamptz, text, bigint, bigint) to anon, authenticated, service_role;

drop view if exists public.event_listings;
create view public.event_listings with (security_invoker = true) as
select
  e.id, e.slug, e.title, e.description, e.image_url, e.category, e.promoter_name,
  e.starts_at, e.doors_at, e.sales_close_at, e.status,
  v.id as venue_id, v.name as venue_name, v.city as venue_city, v.address_line as venue_address, v.postcode as venue_postcode, v.timezone,
  public.listing_from_price(e.id) as from_price_pence,
  s.tickets_left,
  v.lat as venue_lat, v.lng as venue_lng, e.house_favourite,
  e.listed_at,
  public.event_flag(e.status, e.listed_at, e.flag_override, s.capacity, s.tickets_left) as flag
from public.events e
join public.venues v on v.id = e.venue_id
cross join lateral (
  select coalesce(sum(greatest(t.capacity - t.sold - t.held, 0)), 0)::bigint as tickets_left,
         coalesce(sum(t.capacity), 0)::bigint as capacity
  from public.ticket_types t where t.event_id = e.id and t.active
) s
where e.status <> 'draft' and e.visibility = 'public';
grant select on public.event_listings to anon, authenticated, service_role;
