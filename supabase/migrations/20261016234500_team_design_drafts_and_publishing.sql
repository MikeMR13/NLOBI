-- NLOBI Fase A.2 — versiones privadas del diseño del equipo.
-- Sin cambios destructivos ni modificaciones al formato del lector.
CREATE TABLE IF NOT EXISTS public.team_design_revisions (
 id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
 group_id uuid NOT NULL REFERENCES public.translator_groups(id) ON DELETE CASCADE,
 kind text NOT NULL CHECK (kind IN ('draft','published')),
 settings jsonb NOT NULL CHECK (jsonb_typeof(settings)='object' AND pg_column_size(settings)<=28000),
 base_digest text NOT NULL,
 note text NOT NULL DEFAULT '' CHECK (char_length(note)<=100),
 created_by uuid NOT NULL,
 created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS team_design_revisions_group_recent
 ON public.team_design_revisions(group_id,created_at DESC,id DESC);
ALTER TABLE public.team_design_revisions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS team_design_revisions_manager_read ON public.team_design_revisions;
CREATE POLICY team_design_revisions_manager_read ON public.team_design_revisions
 FOR SELECT TO authenticated
 USING (EXISTS (
  SELECT 1 FROM public.group_members m
  WHERE m.group_id=team_design_revisions.group_id
  AND m.user_id=(SELECT auth.uid()) AND m.role IN ('owner','admin')
 ));
REVOKE ALL ON public.team_design_revisions FROM PUBLIC,anon,authenticated;
GRANT SELECT ON public.team_design_revisions TO authenticated;
COMMENT ON TABLE public.team_design_revisions IS
 'Private, append-only design drafts and published versions; no reader data or team identity changes.';

CREATE OR REPLACE FUNCTION public.team_design_save_draft(
 p_group_id uuid,p_settings jsonb,p_note text DEFAULT ''
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$

DECLARE
 v_uid uuid := (select auth.uid());
 v_keys text[] := ARRAY['team_template','team_palette','team_pattern','team_pattern_intensity','team_font','team_cover_style','team_season','team_season_motion','team_season_density','team_season_mode','team_season_start','team_season_end','team_season_message','accent_color','background_color','background_image','background_intensity','theme','header_style','avatar_shape','tagline','short_description','welcome','about','founded','country','languages','genres','status','section_order','recruitment_message','featured_works','seo_description','pinned_posts','new_volume_label','new_chapter_label','credit_text','translator_note','member_credit_order','role_labels','website','discord','twitter','facebook','instagram','youtube','tiktok','github','kofi','patreon','custom_links','show_members','show_works','show_progress','show_followers','show_stats','show_founded','show_team_badge','show_team_logo','show_novel_logo','show_recruitment','show_featured']::text[];
 v_settings jsonb;
 v_target public.team_design_revisions%ROWTYPE;
 v_current jsonb;
 v_group public.translator_groups%ROWTYPE;
 result_id uuid;
BEGIN
 IF v_uid IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.group_members gm
  WHERE gm.group_id=p_group_id AND gm.user_id=v_uid AND gm.role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'No tienes autorización para editar el diseño público del equipo'
 USING ERRCODE='42501'; END IF;
 SELECT * INTO v_group FROM public.translator_groups WHERE id=p_group_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no encontrado' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO v_current
 FROM jsonb_each(coalesce(v_group.profile_settings,'{}'::jsonb)) WHERE key=ANY(v_keys);

 IF p_settings IS NULL OR jsonb_typeof(p_settings)<>'object'
  OR pg_column_size(p_settings)>28000
  OR coalesce(char_length(p_note),0)>100 THEN
  RAISE EXCEPTION 'Borrador inválido o demasiado grande' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_object_keys(p_settings) AS k(key)
   WHERE NOT k.key=ANY(v_keys)) THEN
  RAISE EXCEPTION 'El borrador contiene campos que no pertenecen al diseño' USING ERRCODE='22023';
 END IF;
 IF EXISTS(SELECT 1 FROM jsonb_each(p_settings) AS e(key,value)
   WHERE jsonb_typeof(e.value) NOT IN ('boolean','string','number','null')
      OR length(e.value::text)>8004) THEN
  RAISE EXCEPTION 'El borrador contiene valores no admitidos' USING ERRCODE='22023';
 END IF;
 INSERT INTO public.team_design_revisions(group_id,kind,settings,base_digest,note,created_by)
 VALUES(p_group_id,'draft',p_settings,md5(v_current::text),coalesce(p_note,''),v_uid)
 RETURNING id INTO result_id;
 -- Max 30 drafts per team; published snapshots are maintained separately.
 DELETE FROM public.team_design_revisions
 WHERE group_id=p_group_id AND kind='draft' AND id IN (
   SELECT id FROM public.team_design_revisions
   WHERE group_id=p_group_id AND kind='draft'
   ORDER BY created_at DESC,id DESC OFFSET 30
 );
 RETURN result_id;
END
$fn$;

CREATE OR REPLACE FUNCTION public.team_design_publish(
 p_group_id uuid,p_revision_id uuid
) RETURNS uuid LANGUAGE plpgsql VOLATILE SECURITY DEFINER SET search_path='' AS $fn$

DECLARE
 v_uid uuid := (select auth.uid());
 v_keys text[] := ARRAY['team_template','team_palette','team_pattern','team_pattern_intensity','team_font','team_cover_style','team_season','team_season_motion','team_season_density','team_season_mode','team_season_start','team_season_end','team_season_message','accent_color','background_color','background_image','background_intensity','theme','header_style','avatar_shape','tagline','short_description','welcome','about','founded','country','languages','genres','status','section_order','recruitment_message','featured_works','seo_description','pinned_posts','new_volume_label','new_chapter_label','credit_text','translator_note','member_credit_order','role_labels','website','discord','twitter','facebook','instagram','youtube','tiktok','github','kofi','patreon','custom_links','show_members','show_works','show_progress','show_followers','show_stats','show_founded','show_team_badge','show_team_logo','show_novel_logo','show_recruitment','show_featured']::text[];
 v_settings jsonb;
 v_current jsonb;
 v_group public.translator_groups%ROWTYPE;
 v_target public.team_design_revisions%ROWTYPE;
 result_id uuid;
BEGIN
 IF v_uid IS NULL OR NOT EXISTS(
  SELECT 1 FROM public.group_members gm
  WHERE gm.group_id=p_group_id AND gm.user_id=v_uid AND gm.role IN ('owner','admin')
 ) THEN RAISE EXCEPTION 'No tienes autorización para editar el diseño público del equipo'
 USING ERRCODE='42501'; END IF;
 SELECT * INTO v_group FROM public.translator_groups WHERE id=p_group_id FOR UPDATE;
 IF NOT FOUND THEN RAISE EXCEPTION 'Equipo no encontrado' USING ERRCODE='P0002'; END IF;
 SELECT coalesce(jsonb_object_agg(key,value),'{}'::jsonb) INTO v_current
 FROM jsonb_each(coalesce(v_group.profile_settings,'{}'::jsonb)) WHERE key=ANY(v_keys);

 SELECT * INTO v_target FROM public.team_design_revisions
  WHERE id=p_revision_id AND group_id=p_group_id AND kind IN ('draft','published');
 IF NOT FOUND THEN RAISE EXCEPTION 'Versión no disponible para este equipo' USING ERRCODE='P0002'; END IF;
 IF v_target.kind='draft' AND v_target.base_digest<>md5(v_current::text) THEN
  RAISE EXCEPTION 'El diseño público cambió después de guardar el borrador; vuelve a revisarlo antes de publicar'
  USING ERRCODE='40001';
 END IF;
 IF NOT EXISTS(SELECT 1 FROM public.team_design_revisions
   WHERE group_id=p_group_id AND kind='published') THEN
  INSERT INTO public.team_design_revisions(group_id,kind,settings,base_digest,note,created_by)
  VALUES(p_group_id,'published',v_current,md5(v_current::text),'Apariencia anterior a la primera publicación',v_uid);
 END IF;
 -- Merge only public-design keys; preserve all reader defaults and other settings.
 UPDATE public.translator_groups
 SET profile_settings=(coalesce(profile_settings,'{}'::jsonb) - v_keys) || v_target.settings,
     updated_at=now()
 WHERE id=p_group_id;
 INSERT INTO public.team_design_revisions(group_id,kind,settings,base_digest,note,created_by)
 VALUES(p_group_id,'published',v_target.settings,md5(v_target.settings::text),
  CASE WHEN v_target.kind='published' THEN 'Versión restaurada' ELSE 'Diseño publicado' END,v_uid)
 RETURNING id INTO result_id;
 DELETE FROM public.team_design_revisions
 WHERE group_id=p_group_id AND kind='published' AND id IN (
  SELECT id FROM public.team_design_revisions
  WHERE group_id=p_group_id AND kind='published'
  ORDER BY created_at DESC,id DESC OFFSET 30
 );
 RETURN result_id;
END
$fn$;
REVOKE ALL ON FUNCTION public.team_design_save_draft(uuid,jsonb,text) FROM PUBLIC,anon;
REVOKE ALL ON FUNCTION public.team_design_publish(uuid,uuid) FROM PUBLIC,anon;
GRANT EXECUTE ON FUNCTION public.team_design_save_draft(uuid,jsonb,text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.team_design_publish(uuid,uuid) TO authenticated;
COMMENT ON FUNCTION public.team_design_publish(uuid,uuid) IS 'Owner/admin only; atomic public design publish or restore, with draft conflict detection and preservation of reader settings.';
