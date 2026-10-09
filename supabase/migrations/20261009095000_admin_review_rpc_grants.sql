-- Hardening: moderation RPCs are strictly authenticated APIs.
-- The functions themselves still enforce site administrator authorization.
revoke execute on function public.get_admin_review_reports() from anon,public;
revoke execute on function public.moderate_translation_review_report(uuid,text) from anon,public;
grant execute on function public.get_admin_review_reports() to authenticated;
grant execute on function public.moderate_translation_review_report(uuid,text) to authenticated;