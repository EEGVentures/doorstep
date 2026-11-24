-- New Supabase projects (from late 2026) no longer give the API roles access to
-- tables by default. Grant it explicitly. Row-level security still decides which
-- rows each role can see, and the functions revoked earlier stay service-only.

grant usage on schema public to anon, authenticated, service_role;

-- Guests can browse public events (policies limit rows to non-draft, public).
grant select on public.venues, public.events, public.ticket_types to anon;

-- Signed-in users: every table and view has RLS or security_invoker, so the
-- policies decide what each person sees.
grant select on all tables in schema public to authenticated;
grant insert, delete on public.waitlist_entries to authenticated;

-- Helpers used inside policies and by the app.
grant execute on function public.current_role_is(variadic public.app_role[]) to anon, authenticated;
grant execute on function public.reveal_lead() to anon, authenticated;
grant execute on function public.has_active_membership(uuid) to authenticated;

-- The server (service role) does all writes.
grant all on all tables in schema public to service_role;
grant usage, select on all sequences in schema public to service_role;
grant execute on all functions in schema public to service_role;
alter default privileges in schema public grant all on tables to service_role;
alter default privileges in schema public grant usage, select on sequences to service_role;
alter default privileges in schema public grant execute on functions to service_role;
