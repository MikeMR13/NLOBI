-- Applied to Supabase production as migration 20261007215733.
-- Force project creation through the atomic RPC so direct REST inserts cannot leave orphan novels.
drop policy if exists novels_editor_insert on public.novels;
revoke insert on public.novels from authenticated;
grant insert on public.novels to service_role;
