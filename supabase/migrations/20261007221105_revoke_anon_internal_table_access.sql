-- Applied to Supabase production as migration 20261007221105.
-- Remove SQL visibility on internal-only tables for anonymous clients.
revoke select on public.beta_feedback from anon;
revoke select on public.comment_reports from anon;
revoke select on public.follows from anon;
revoke select on public.group_members from anon;
revoke select on public.import_jobs from anon;
revoke select on public.moderation_audit from anon;
revoke select on public.notification_preferences from anon;
revoke select on public.notifications from anon;
revoke select on public.reading_history from anon;
revoke select on public.section_revisions from anon;
revoke select on public.site_admins from anon;
revoke select on public.team_applications from anon;
