-- Studio fase 1: preparar metadatos editoriales y guardado transaccional.
-- Aplicar antes de desplegar el frontend que utiliza save_studio_section_atomic.
-- Las opciones visibles y la automatización del volumen final corresponden a fase 2.

alter table public.novels drop constraint if exists novels_novel_type_check;
alter table public.novels add constraint novels_novel_type_check
  check (novel_type is null or novel_type in ('light_novel','web_novel','original','other'));

alter table public.translations drop constraint if exists translations_status_check;
alter table public.translations add constraint translations_status_check
  check (status in (
    'active','paused','abandoned','complete','withdrawn',
    'awaiting_sequel','no_sequel_confirmed'
  ));

alter table public.volumes
  add column if not exists is_final_volume boolean not null default false;
alter table public.volumes
  add column if not exists final_translation_status text;
alter table public.volumes drop constraint if exists volumes_final_translation_intent_check;
alter table public.volumes add constraint volumes_final_translation_intent_check
  check (
    (not is_final_volume and final_translation_status is null)
    or (is_final_volume and final_translation_status in
      ('complete','awaiting_sequel','no_sequel_confirmed'))
  );

create or replace function public.save_studio_section_atomic(
  p_section_id uuid,
  p_expected_updated_at timestamptz,
  p_title text,
  p_section_type text,
  p_content jsonb,
  p_save_revision boolean default false,
  p_revision_note text default null
)
returns timestamptz
language plpgsql
security invoker
set search_path = ''
as $function$
declare
  previous public.sections%rowtype;
  saved_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_expected_updated_at is null then
    raise exception 'Expected revision timestamp required' using errcode = '22023';
  end if;
  if nullif(btrim(coalesce(p_title,'')),'') is null
    or nullif(btrim(coalesce(p_section_type,'')),'') is null
    or jsonb_typeof(p_content) is distinct from 'array' then
    raise exception 'Invalid chapter data' using errcode = '22023';
  end if;

  -- El bloqueo serializa cambios simultáneos y evita sobrescribir otra sesión.
  select * into previous
  from public.sections
  where id = p_section_id
  for update;
  if not found then
    raise exception 'Chapter not found or no access' using errcode = '42501';
  end if;
  if previous.updated_at is distinct from p_expected_updated_at then
    raise exception 'STUDIO_EDIT_CONFLICT: chapter changed in another session'
      using errcode = '40001';
  end if;

  -- Las políticas RLS y los triggers del equipo siguen siendo obligatorios.
  update public.sections
     set title = btrim(p_title),
         section_type = p_section_type,
         content = p_content,
         updated_at = clock_timestamp()
   where id = p_section_id
   returning updated_at into saved_at;
  if not found then
    raise exception 'Editorial permission required' using errcode = '42501';
  end if;

  if coalesce(p_save_revision,false) then
    -- Se inserta la versión anterior en la misma transacción.
    -- Si falla por RLS u otra razón, también se revierte la edición.
    insert into public.section_revisions
      (section_id, created_by, title, section_type, content, revision_note)
    values
      (p_section_id, auth.uid(), previous.title, previous.section_type,
       previous.content, nullif(btrim(p_revision_note),''));
  end if;
  return saved_at;
end;
$function$;

revoke all on function public.save_studio_section_atomic(
  uuid,timestamptz,text,text,jsonb,boolean,text
) from public, anon;
grant execute on function public.save_studio_section_atomic(
  uuid,timestamptz,text,text,jsonb,boolean,text
) to authenticated, service_role;
