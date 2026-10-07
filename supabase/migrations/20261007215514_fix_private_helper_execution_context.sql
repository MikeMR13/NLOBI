-- Applied to Supabase production as migration 20261007215514.
alter function private.purchase_link_guard() security definer;
alter function private.purchase_link_guard() set search_path = '';
revoke all on function private.purchase_link_guard() from public, anon, authenticated;

alter function public.admin_review_purchase_link(uuid,boolean) security definer;
alter function public.admin_review_purchase_link(uuid,boolean) set search_path = '';
revoke all on function public.admin_review_purchase_link(uuid,boolean) from public, anon;
grant execute on function public.admin_review_purchase_link(uuid,boolean) to authenticated, service_role;

alter function public.admin_review_team_application(uuid,text,text) security definer;
alter function public.admin_review_team_application(uuid,text,text) set search_path = '';
revoke all on function public.admin_review_team_application(uuid,text,text) from public, anon;
grant execute on function public.admin_review_team_application(uuid,text,text) to authenticated, service_role;
