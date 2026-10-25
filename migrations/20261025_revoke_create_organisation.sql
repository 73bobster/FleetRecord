-- Organisations are created by the platform owner (service role / SQL editor), never from the app.
-- Applied to the live database on 2026-10-25.
revoke execute on function public.create_organisation(text, text, text) from public, anon, authenticated;
grant execute on function public.create_organisation(text, text, text) to service_role;
