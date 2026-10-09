-- Already applied to Supabase NLOBI as migration 20261009000313.
-- Correct team identity checks and add indexes for unindexed foreign keys.
ALTER POLICY volume_schedule_add ON public.volume_publication_schedule
WITH CHECK (
 private.team_action_allowed(group_id,'schedule')
 AND created_by=(SELECT auth.uid())
 AND EXISTS (
  SELECT 1 FROM public.volumes v
  JOIN public.translations t ON t.id=v.translation_id
  WHERE v.id=volume_publication_schedule.volume_id
  AND t.group_id=volume_publication_schedule.group_id
 )
 AND scheduled_at>now()
);
ALTER POLICY review_request_insert ON public.editorial_review_requests
WITH CHECK (
 status='pending'
 AND requested_by=(SELECT auth.uid())
 AND (private.team_action_allowed(group_id,'edit') OR private.team_action_allowed(group_id,'create'))
 AND EXISTS (
  SELECT 1 FROM public.sections s
  JOIN public.volumes v ON v.id=s.volume_id
  JOIN public.translations t ON t.id=v.translation_id
  WHERE s.id=editorial_review_requests.section_id
  AND t.group_id=editorial_review_requests.group_id
 )
 AND (assigned_to IS NULL OR EXISTS (
  SELECT 1 FROM public.group_members gm
  WHERE gm.group_id=editorial_review_requests.group_id
  AND gm.user_id=editorial_review_requests.assigned_to
 ))
);
CREATE INDEX IF NOT EXISTS editorial_review_requests_assigned_to_idx ON public.editorial_review_requests(assigned_to);
CREATE INDEX IF NOT EXISTS editorial_review_requests_group_id_idx ON public.editorial_review_requests(group_id);
CREATE INDEX IF NOT EXISTS editorial_review_requests_requested_by_idx ON public.editorial_review_requests(requested_by);
CREATE INDEX IF NOT EXISTS editorial_review_requests_reviewed_by_idx ON public.editorial_review_requests(reviewed_by);
CREATE INDEX IF NOT EXISTS read_sections_section_id_idx ON public.read_sections(section_id);
CREATE INDEX IF NOT EXISTS volume_publication_schedule_created_by_idx ON public.volume_publication_schedule(created_by);
CREATE INDEX IF NOT EXISTS volume_publication_schedule_group_id_idx ON public.volume_publication_schedule(group_id);
