-- Applied to Supabase: prevent cross-table NEW field access.
CREATE OR REPLACE FUNCTION private.team_content_guard()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
DECLARE gid uuid; action_name text; vid uuid; tid uuid;
BEGIN
 IF tg_table_name='sections' THEN
  IF tg_op='DELETE' THEN vid:=old.volume_id; ELSE vid:=new.volume_id; END IF;
  SELECT t.group_id INTO gid FROM public.volumes v JOIN public.translations t ON t.id=v.translation_id WHERE v.id=vid;
 ELSIF tg_table_name='volumes' THEN
  IF tg_op='DELETE' THEN tid:=old.translation_id; ELSE tid:=new.translation_id; END IF;
  SELECT group_id INTO gid FROM public.translations WHERE id=tid;
 ELSE
  IF tg_op='DELETE' THEN gid:=old.group_id; ELSE gid:=new.group_id; END IF;
 END IF;
 IF gid IS NULL AND tg_op='DELETE' THEN RETURN old; END IF;
 IF tg_op='DELETE' THEN action_name:='delete';
 ELSIF tg_op='INSERT' THEN action_name:='create';
 ELSIF tg_op='UPDATE' THEN
  IF new.status IS DISTINCT FROM old.status THEN
   IF tg_table_name='sections' THEN
    IF (new.title,new.content,new.section_type,new.section_number,new.sort_order) IS DISTINCT FROM
       (old.title,old.content,old.section_type,old.section_number,old.sort_order)
       AND NOT private.team_action_allowed(gid,'edit') THEN
       RAISE EXCEPTION 'No puedes editar el capítulo durante su publicación';
    END IF;
   ELSIF tg_table_name='volumes' THEN
    IF (new.title,new.cover_url,new.volume_number) IS DISTINCT FROM
       (old.title,old.cover_url,old.volume_number)
       AND NOT private.team_action_allowed(gid,'edit') THEN
       RAISE EXCEPTION 'No puedes editar el volumen durante su publicación';
    END IF;
   END IF;
   action_name:='publish';
  ELSE action_name:='edit'; END IF;
 END IF;
 IF NOT (current_user='postgres' AND auth.uid() IS NULL)
    AND NOT private.team_action_allowed(gid,action_name)
    AND NOT private.is_site_admin() THEN
    RAISE EXCEPTION 'Permiso % denegado para este equipo',action_name USING errcode='42501';
 END IF;
 IF tg_op='DELETE' THEN RETURN old; ELSE RETURN new; END IF;
END
$function$
;
