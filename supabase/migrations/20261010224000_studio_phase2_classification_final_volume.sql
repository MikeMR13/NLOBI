-- Studio fase 2. Requiere la migración de fundamentos de fase 1.
-- Separa estado de la traducción (editorial) del estado del original (novels.status).

alter table public.translations
  add column if not exists auto_status_source_volume_id uuid
  references public.volumes(id) on delete set null;
alter table public.translations
  add column if not exists auto_status_previous_status text;
alter table public.translations drop constraint if exists translations_auto_status_previous_check;
alter table public.translations add constraint translations_auto_status_previous_check
  check (auto_status_previous_status is null or auto_status_previous_status in
    ('active','paused','abandoned','complete','withdrawn','awaiting_sequel','no_sequel_confirmed'));

-- La ruta de creación nueva valida el tipo y el estado ANTES de crear ningún registro.
-- Reutiliza el RPC transaccional autenticado de fase anterior.
create or replace function public.create_translation_project_with_metadata(
  p_group_id uuid,
  p_title text,
  p_title_original text,
  p_author_name text,
  p_synopsis text,
  p_cover_url text,
  p_genres text[],
  p_tags text[],
  p_language_code text,
  p_novel_type text,
  p_translation_status text
)
returns table(translation_id uuid, novel_id uuid)
language plpgsql security invoker set search_path = ''
as $function$
declare
  v_translation_id uuid;
  v_novel_id uuid;
  v_rows integer;
begin
  if p_novel_type is null or p_novel_type not in ('light_novel','web_novel','original') then
    raise exception 'Selecciona el tipo de obra' using errcode='22023';
  end if;
  if p_translation_status is null or p_translation_status not in
     ('active','paused','abandoned','complete','awaiting_sequel','no_sequel_confirmed') then
    raise exception 'Estado de traducción inválido' using errcode='22023';
  end if;
  select created.translation_id, created.novel_id
    into v_translation_id, v_novel_id
  from public.create_translation_project(
    p_group_id,p_title,p_title_original,p_author_name,p_synopsis,
    p_cover_url,p_genres,p_tags,p_language_code
  ) created;
  if v_translation_id is null or v_novel_id is null then
    raise exception 'No se pudo crear el proyecto' using errcode='P0001';
  end if;
  update public.novels set novel_type=p_novel_type,updated_at=now()
    where id=v_novel_id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'No se pudo asignar el tipo de obra'; end if;
  update public.translations
    set status=p_translation_status,updated_at=now()
    where id=v_translation_id;
  get diagnostics v_rows=row_count;
  if v_rows<>1 then raise exception 'No se pudo asignar el estado de traducción'; end if;
  return query select v_translation_id,v_novel_id;
end;
$function$;
revoke all on function public.create_translation_project_with_metadata(
 uuid,text,text,text,text,text,text[],text[],text,text,text
) from public,anon;
grant execute on function public.create_translation_project_with_metadata(
 uuid,text,text,text,text,text,text[],text[],text,text,text
) to authenticated,service_role;

-- Un cambio de estado manual cancela la relación con un volumen final anterior.
create or replace function private.clear_manual_translation_final_status()
returns trigger language plpgsql set search_path = ''
as $function$
begin
  if pg_trigger_depth()=1 and new.status is distinct from old.status then
    new.auto_status_source_volume_id:=null;
    new.auto_status_previous_status:=null;
  end if;
  return new;
end;
$function$;
drop trigger if exists clear_manual_translation_final_status on public.translations;
create trigger clear_manual_translation_final_status
before update of status on public.translations
for each row execute function private.clear_manual_translation_final_status();

-- Se ejecuta al PUBLICAR: sirve tanto al botón de Studio como al programador.
-- Registra el origen y el estado previo para deshacer solo cambios automáticos.
-- Si el último volumen final se corrige/oculta/elimina, recuperar el final
-- publicado anterior (si existe) sin anular cambios manuales posteriores.
create or replace function private.restore_previous_published_final(
  p_volume_id uuid,p_translation_id uuid,p_final_status text
)
returns void language plpgsql security definer set search_path = ''
as $restore$
declare
  tr public.translations%rowtype;
  fallback_volume public.volumes%rowtype;
begin
  select * into tr from public.translations
  where id=p_translation_id for update;
  if not found or tr.auto_status_source_volume_id is distinct from p_volume_id then return; end if;
  select * into fallback_volume
  from public.volumes
  where translation_id=p_translation_id
    and id<>p_volume_id and is_final_volume and status='published'
  order by published_at desc nulls last,volume_number desc limit 1;
  update public.translations
  set status=case
        when status=p_final_status then coalesce(fallback_volume.final_translation_status,tr.auto_status_previous_status,'active')
        else status end,
      auto_status_source_volume_id=case
        when status=p_final_status then fallback_volume.id
        else null end,
      auto_status_previous_status=case
        when status=p_final_status and fallback_volume.id is not null
        then tr.auto_status_previous_status else null end,
      updated_at=now()
  where id=p_translation_id;
end;
$restore$;
revoke all on function private.restore_previous_published_final(uuid,uuid,text)
from public,anon,authenticated;

create or replace function private.sync_published_final_volume()
returns trigger
language plpgsql security definer set search_path = ''
as $function$
declare
  tr public.translations%rowtype;
begin
  if tg_op = 'DELETE' then
    if old.is_final_volume and old.status='published' then
      perform private.restore_previous_published_final(
        old.id,old.translation_id,old.final_translation_status
      );
    end if;
    return old;
  end if;

  if new.status='published' and new.is_final_volume and
    (old.status is distinct from new.status
     or old.is_final_volume is distinct from new.is_final_volume
     or old.final_translation_status is distinct from new.final_translation_status) then
    select * into tr from public.translations where id=new.translation_id for update;
    if not found then raise exception 'Traducción no encontrada'; end if;
    if tr.status='withdrawn' then
      raise exception 'No se puede finalizar una traducción retirada';
    end if;
    update public.translations
    set status=new.final_translation_status,
        auto_status_source_volume_id=new.id,
        auto_status_previous_status=case
          when tr.auto_status_source_volume_id is null then tr.status
          else coalesce(tr.auto_status_previous_status,tr.status)
        end,
        updated_at=now()
    where id=new.translation_id;
  elsif old.status='published' and old.is_final_volume
    and (new.status is distinct from 'published' or not new.is_final_volume) then
    perform private.restore_previous_published_final(
      new.id,new.translation_id,old.final_translation_status
    );
  end if;
  return new;
end;
$function$;
revoke all on function private.sync_published_final_volume() from public,anon,authenticated;
drop trigger if exists volume_final_status_update on public.volumes;
create trigger volume_final_status_update
after update of status,is_final_volume,final_translation_status on public.volumes
for each row execute function private.sync_published_final_volume();
drop trigger if exists volume_final_status_delete on public.volumes;
create trigger volume_final_status_delete
before delete on public.volumes
for each row execute function private.sync_published_final_volume();

-- Se publican también los estados de continuación, pausa y abandono.
-- 'withdrawn' permanece privado y no se altera la visibilidad de borradores.
do $policy$
declare
  item record;
  old_states text := 'ARRAY[''active''::text, ''complete''::text, ''paused''::text]';
  new_states text := 'ARRAY[''active''::text, ''complete''::text, ''paused''::text, ''abandoned''::text, ''awaiting_sequel''::text, ''no_sequel_confirmed''::text]';
begin
  for item in
    select tablename,policyname,qual,with_check
    from pg_catalog.pg_policies
    where schemaname='public'
      and tablename in (
        'translations','novels','volumes','sections','comments','comment_reactions',
        'comment_reports','download_links','purchase_links','library_entries',
        'reader_collection_items','reading_progress','translation_ratings',
        'translation_review_votes','translation_reviews'
      )
      and (position(old_states in coalesce(qual,''))>0
        or position(old_states in coalesce(with_check,''))>0)
  loop
    if item.qual is not null and position(old_states in item.qual)>0 then
      execute format('alter policy %I on public.%I using (%s)',
        item.policyname,item.tablename,replace(item.qual,old_states,new_states));
    end if;
    if item.with_check is not null and position(old_states in item.with_check)>0 then
      execute format('alter policy %I on public.%I with check (%s)',
        item.policyname,item.tablename,replace(item.with_check,old_states,new_states));
    end if;
  end loop;
end;
$policy$;

-- Las funciones públicas de comunidad/rating que filtraban 3 estados también
-- deben aceptar los nuevos. Reemplazo limitado a las funciones enumeradas.
do $functions$
declare
  item record;
  source text;
  old_states text := '''active'',''complete'',''paused''';
  new_states text := '''active'',''complete'',''paused'',''abandoned'',''awaiting_sequel'',''no_sequel_confirmed''';
begin
  for item in
    select p.oid from pg_catalog.pg_proc p
    join pg_catalog.pg_namespace n on n.oid=p.pronamespace
    where n.nspname='public' and p.prokind='f'
      and p.proname in (
        'get_discoverable_readers','get_followed_reader_activity',
        'get_public_reader_reviews','get_translation_rating_distribution',
        'get_translation_rating_summaries','get_translation_reviews'
      )
  loop
    source:=pg_catalog.pg_get_functiondef(item.oid);
    if position(old_states in source)>0 then
      execute replace(source,old_states,new_states);
    end if;
  end loop;
end;
$functions$;
