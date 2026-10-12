-- No deducir estados de la novela original o de una secuela cuando no han sido confirmados.
-- Conservamos las clasificaciones existentes: no es posible distinguir las manuales de los valores históricos predeterminados.
-- El estado operativo de la traducción sigue siendo obligatorio para el flujo de publicación.
alter table public.novels alter column status drop default;
alter table public.novels alter column sequel_status drop default;
alter table public.novels alter column sequel_status drop not null;

-- Mantener la autorización, búsqueda segura y semántica transaccional del RPC existente.
create or replace function public.update_editorial_states(
 p_translation_id uuid,
 p_novel_status text,
 p_translation_status text,
 p_sequel_status text
)
returns void
language plpgsql
set search_path = ''
as $function$
declare
 v_group_id uuid;
 v_novel_id uuid;
 v_sequel_status text := nullif(p_sequel_status,'unspecified');
begin
 if auth.uid() is null then
   raise exception 'Debes iniciar sesion para modificar estos estados' using errcode = '28000';
 end if;

 if (p_novel_status is not null and p_novel_status not in ('ongoing','completed','hiatus','cancelled'))
    or p_translation_status is null
    or p_translation_status not in ('active','paused','abandoned','complete','withdrawn')
    or (v_sequel_status is not null and v_sequel_status not in ('awaiting','unconfirmed','announced','publishing','completed')) then
   raise exception 'Uno o mas estados editoriales no son validos' using errcode = '22023';
 end if;

 select t.group_id,t.novel_id into v_group_id,v_novel_id
 from public.translations t
 where t.id=p_translation_id
 for update;
 if v_group_id is null then
   raise exception 'Proyecto no disponible' using errcode = 'P0002';
 end if;
 if not (private.team_action_allowed(v_group_id,'edit') or private.is_site_admin()) then
   raise exception 'No tienes permiso para cambiar los estados de este proyecto' using errcode = '42501';
 end if;

 update public.novels
 set status=p_novel_status,sequel_status=v_sequel_status,updated_at=now()
 where id=v_novel_id;
 if not found then raise exception 'No se pudo actualizar la obra original' using errcode='42501'; end if;

 update public.translations
 set status=p_translation_status,updated_at=now()
 where id=p_translation_id;
 if not found then raise exception 'No se pudo actualizar el proyecto de traduccion' using errcode='42501'; end if;
end;
$function$;

-- El RPC previo creaba TODAS las novelas como 'ongoing' aun si el equipo no lo indicó.
-- Se conserva su verificación de permisos y firma sin añadir datos públicos falsos.
create or replace function public.create_translation_project(
 p_group_id uuid,
 p_title text,
 p_title_original text default null::text,
 p_author_name text default null::text,
 p_synopsis text default null::text,
 p_cover_url text default null::text,
 p_genres text[] default '{}'::text[],
 p_tags text[] default '{}'::text[],
 p_language_code text default 'es'::text
)
returns table(translation_id uuid,novel_id uuid)
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
 if char_length(p_title)>220 then raise exception 'Title too long'; end if;
 if p_language_code is null or char_length(btrim(p_language_code))<2 or char_length(btrim(p_language_code))>12 then
   raise exception 'Invalid language code';
 end if;

 v_slug:=regexp_replace(
   lower(translate(p_title,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),
   '[^a-z0-9]+','-','g');
 v_slug:=trim(both '-' from v_slug);
 if v_slug='' then v_slug:='obra'; end if;
 v_slug:=left(v_slug,80)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);

 insert into public.novels(slug,title,title_original,author_name,synopsis,cover_url,genres,tags,status,sequel_status)
 values (
   v_slug,btrim(p_title),nullif(btrim(p_title_original),''),
   nullif(btrim(p_author_name),''),nullif(btrim(p_synopsis),''),
   nullif(btrim(p_cover_url),''),coalesce(p_genres,'{}'),coalesce(p_tags,'{}'),null,null
 )
 returning id into v_novel_id;

 insert into public.translations(novel_id,group_id,language_code,title,status)
 values(v_novel_id,p_group_id,lower(btrim(p_language_code)),btrim(p_title),'active')
 returning id into v_translation_id;

 return query select v_translation_id,v_novel_id;
end;
$function$;

comment on column public.novels.status is 'Estado confirmado de publicación de la obra fuente; NULL si no hay información verificada.';
comment on column public.novels.sequel_status is 'Estado confirmado de una secuela; NULL si no hay información verificada. unspecified se admite como valor histórico sin publicación.';
