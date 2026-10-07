-- Applied to Supabase production as migration 20261007233106.
-- Keep work title synchronized across novels/translations and publish a volume with all its sections atomically.

create or replace function public.update_translation_project_title(
  p_translation_id uuid,
  p_title text
)
returns void
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_novel_id uuid;
  v_rows integer;
  v_title text := btrim(coalesce(p_title,''));
begin
  if v_title = '' then raise exception 'Title required'; end if;
  if char_length(v_title) > 220 then raise exception 'Title too long'; end if;

  select t.novel_id into v_novel_id
  from public.translations t
  where t.id = p_translation_id;

  if v_novel_id is null then raise exception 'Translation not found or not accessible'; end if;

  update public.translations
  set title = v_title, updated_at = now()
  where id = p_translation_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Editorial permission required'; end if;

  update public.novels
  set title = v_title, updated_at = now()
  where id = v_novel_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Could not update novel title'; end if;
end;
$function$;

revoke all on function public.update_translation_project_title(uuid,text) from public, anon;
grant execute on function public.update_translation_project_title(uuid,text) to authenticated, service_role;

create or replace function public.publish_volume_with_sections(
  p_volume_id uuid
)
returns integer
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  v_rows integer;
  v_sections integer;
begin
  update public.volumes
  set status = 'published',
      published_at = case when status = 'published' and published_at is not null then published_at else now() end,
      updated_at = now()
  where id = p_volume_id;

  get diagnostics v_rows = row_count;
  if v_rows <> 1 then raise exception 'Volume not found or editorial permission required'; end if;

  update public.sections
  set status = 'published',
      published_at = case when status = 'published' and published_at is not null then published_at else now() end,
      updated_at = now()
  where volume_id = p_volume_id;

  get diagnostics v_sections = row_count;
  return v_sections;
end;
$function$;

revoke all on function public.publish_volume_with_sections(uuid) from public, anon;
grant execute on function public.publish_volume_with_sections(uuid) to authenticated, service_role;
