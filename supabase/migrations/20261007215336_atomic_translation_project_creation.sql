-- Applied to Supabase production as migration 20261007215336.
create or replace function public.create_translation_project(
  p_group_id uuid,
  p_title text,
  p_title_original text default null,
  p_author_name text default null,
  p_synopsis text default null,
  p_cover_url text default null,
  p_genres text[] default '{}',
  p_tags text[] default '{}',
  p_language_code text default 'es'
)
returns table(translation_id uuid, novel_id uuid)
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_novel_id uuid;
  v_translation_id uuid;
  v_slug text;
begin
  if auth.uid() is null then raise exception 'Authentication required'; end if;
  if not (private.is_site_admin() or private.is_group_editor(p_group_id)) then
    raise exception 'Editorial permission required';
  end if;
  if nullif(btrim(p_title),'') is null then raise exception 'Title required'; end if;
  if char_length(p_title) > 220 then raise exception 'Title too long'; end if;
  if p_language_code is null or char_length(btrim(p_language_code)) < 2 or char_length(btrim(p_language_code)) > 12 then
    raise exception 'Invalid language code';
  end if;

  v_slug := regexp_replace(lower(translate(p_title,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),'[^a-z0-9]+','-','g');
  v_slug := trim(both '-' from v_slug);
  if v_slug = '' then v_slug := 'obra'; end if;
  v_slug := left(v_slug,80) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,8);

  insert into public.novels(slug,title,title_original,author_name,synopsis,cover_url,genres,tags,status)
  values(v_slug,btrim(p_title),nullif(btrim(p_title_original),''),nullif(btrim(p_author_name),''),nullif(btrim(p_synopsis),''),nullif(btrim(p_cover_url),''),coalesce(p_genres,'{}'),coalesce(p_tags,'{}'),'ongoing')
  returning id into v_novel_id;

  insert into public.translations(novel_id,group_id,language_code,title,status)
  values(v_novel_id,p_group_id,lower(btrim(p_language_code)),btrim(p_title),'active')
  returning id into v_translation_id;

  return query select v_translation_id,v_novel_id;
end;
$function$;

revoke all on function public.create_translation_project(uuid,text,text,text,text,text,text[],text[],text) from public, anon;
grant execute on function public.create_translation_project(uuid,text,text,text,text,text,text[],text[],text) to authenticated, service_role;
