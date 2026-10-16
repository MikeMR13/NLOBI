-- NLOBI / OX-MR Fase D
-- Source: existing read_sections (a chapter marked read once per reader).
-- These are chapter-completion signals, NOT raw page views or reading sessions.
-- No new personal tracking, no scheduled jobs, no paid services.
ALTER TABLE public.volumes
  ADD COLUMN IF NOT EXISTS bibliography jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $ddl$
BEGIN
 IF NOT EXISTS (
   SELECT 1 FROM pg_constraint WHERE conrelid='public.volumes'::regclass AND conname='volumes_bibliography_bounds_check'
 ) THEN
  ALTER TABLE public.volumes ADD CONSTRAINT volumes_bibliography_bounds_check
  CHECK (jsonb_typeof(bibliography)='object' AND pg_column_size(bibliography)<=4096);
 END IF;
END $ddl$;

COMMENT ON COLUMN public.volumes.bibliography IS
  'Optional, volume-level ISBN, illustrator, publisher, Japanese publication date and planned chapters. Unknown values remain absent.';

-- Private completion rows stay protected under their existing RLS.
-- The function must aggregate across members, so it runs as definer with a
-- strict owner/admin membership gate. Only anonymized buckets of 5+ distinct
-- readers are emitted. User IDs and source rows are NEVER returned.
CREATE OR REPLACE FUNCTION public.team_reading_snapshot(
  p_group_id uuid, p_days integer DEFAULT 30
)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = ''
AS $fn$
DECLARE
  result jsonb;
BEGIN
 IF (SELECT auth.uid()) IS NULL OR NOT EXISTS(
   SELECT 1 FROM public.group_members m
   WHERE m.group_id=p_group_id AND m.user_id=(SELECT auth.uid())
     AND m.role IN ('owner','admin')
 ) THEN
  RAISE EXCEPTION 'No autorizado para consultar métricas agregadas'
    USING ERRCODE='42501';
 END IF;
 IF p_days IS DISTINCT FROM 30 THEN
  RAISE EXCEPTION 'Solo se permite la ventana fija de 30 días'
    USING ERRCODE='22023';
 END IF;

 WITH entries AS MATERIALIZED (
  SELECT r.user_id,r.section_id,(r.read_at AT TIME ZONE 'UTC')::date AS day_utc,
         s.title AS chapter_title,v.volume_number,t.id AS translation_id,
         coalesce(nullif(t.title,''),n.title) AS novel_title
  FROM public.read_sections r
  JOIN public.sections s ON s.id=r.section_id AND s.status='published'
  JOIN public.volumes v ON v.id=s.volume_id AND v.status='published'
  JOIN public.translations t ON t.id=v.translation_id AND t.group_id=p_group_id
  JOIN public.novels n ON n.id=t.novel_id
  WHERE r.read_at >= now() - (p_days::text || ' days')::interval
 ), total AS (
  SELECT count(*) AS completions,count(DISTINCT user_id) AS readers FROM entries
 ), daily AS (
  SELECT day_utc,count(*) AS completions,count(DISTINCT user_id) AS readers
  FROM entries GROUP BY day_utc HAVING count(DISTINCT user_id)>=5
 ), chapters AS (
  SELECT section_id,chapter_title,volume_number,novel_title,
         count(*) AS completions,count(DISTINCT user_id) AS readers
  FROM entries GROUP BY section_id,chapter_title,volume_number,novel_title
  HAVING count(DISTINCT user_id)>=5
 )
 SELECT jsonb_build_object(
  'days',p_days,'minimum_readers',5,
  'qualified',(SELECT readers>=5 FROM total),
  'unique_readers',(SELECT CASE WHEN readers>=5 THEN readers ELSE NULL END FROM total),
  'chapter_completions',(SELECT CASE WHEN readers>=5 THEN completions ELSE NULL END FROM total),
  'daily',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'date',day_utc,'completions',completions,'readers',readers) ORDER BY day_utc) FROM daily),'[]'::jsonb),
  'chapters',coalesce((SELECT jsonb_agg(jsonb_build_object(
     'section_id',section_id,'title',chapter_title,'novel_title',novel_title,
     'volume_number',volume_number,'completions',completions) ORDER BY completions DESC)
     FROM (SELECT * FROM chapters ORDER BY completions DESC LIMIT 10) AS limited),'[]'::jsonb)
 ) INTO result;
 RETURN result;
END
$fn$;

REVOKE ALL ON FUNCTION public.team_reading_snapshot(uuid,integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.team_reading_snapshot(uuid,integer) TO authenticated;

COMMENT ON FUNCTION public.team_reading_snapshot(uuid,integer) IS
 'Owner/admin-only daily chapter completion aggregates, UTC dates, 5-reader privacy threshold; never returns reading_history or user ids.';
