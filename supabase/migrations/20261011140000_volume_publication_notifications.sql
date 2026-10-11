-- Publicación: un aviso por volumen y operación, no un aviso por capítulo.
-- Conserva el historial antiguo; este cambio se aplica a avisos futuros.
alter table public.notifications
  add column if not exists volume_id uuid references public.volumes(id) on delete set null;
create index if not exists idx_notifications_volume on public.notifications(volume_id);

-- Se ejecuta a través de disparadores, respetando el seguimiento y las
-- preferencias actuales. La clave por transacción evita duplicar avisos al
-- publicar varios capítulos en bloque o actualizar metadatos y contenido juntos.
create or replace function private.notify_volume_activity(p_volume_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_translation_id uuid;
  v_novel_id uuid;
  v_group_id uuid;
  v_work_title text;
  v_volume_title text;
  v_volume_number numeric;
begin
  if p_kind not in ('published', 'updated') then
    raise exception 'Invalid volume activity';
  end if;

  select t.id, t.novel_id, t.group_id, n.title, v.title, v.volume_number
    into v_translation_id, v_novel_id, v_group_id, v_work_title,
         v_volume_title, v_volume_number
  from public.volumes v
  join public.translations t on t.id = v.translation_id
  join public.novels n on n.id = t.novel_id
  where v.id = p_volume_id
    and v.status = 'published'
    and t.status in ('active','complete','paused');

  if v_translation_id is null then return; end if;

  insert into public.notifications
   (user_id, notification_type, title, body, translation_id,
    volume_id, section_id, event_key)
  select distinct f.user_id,
    'new_publication',
    (case when p_kind='published' then 'Nuevo volumen · '
          else 'Volumen actualizado · ' end) || coalesce(v_work_title,'Novela'),
    'Vol. ' || v_volume_number::text ||
      coalesce(' · ' || nullif(v_volume_title,''),''),
    v_translation_id, p_volume_id, null::uuid,
    'volume-activity:' || p_volume_id::text || ':' ||
      pg_catalog.txid_current()::text || ':' || f.user_id::text
  from public.follows f
  where (
    (f.target_type = 'novel' and f.target_id = v_novel_id)
    or (f.target_type = 'translation' and f.target_id = v_translation_id)
    or (f.target_type = 'translator_group' and f.target_id = v_group_id)
  )
  and private.notification_enabled(f.user_id,'new_publications')
  on conflict do nothing;
end;
$$;

-- No se permite invocar directamente una función que emite notificaciones.
revoke all on function private.notify_volume_activity(uuid,text)
  from public, anon, authenticated;

create or replace function private.notify_volume_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then return new; end if;
  if tg_op = 'INSERT' then
    perform private.notify_volume_activity(new.id,'published');
  elsif old.status is distinct from 'published' then
    perform private.notify_volume_activity(new.id,'published');
  elsif (new.title, new.volume_number, new.cover_url)
      is distinct from (old.title, old.volume_number, old.cover_url) then
    perform private.notify_volume_activity(new.id,'updated');
  end if;
  return new;
end;
$$;
revoke all on function private.notify_volume_activity_trigger()
  from public, anon, authenticated;

drop trigger if exists trg_notify_volume_activity on public.volumes;
create trigger trg_notify_volume_activity
after insert or update of status, title, volume_number, cover_url
on public.volumes
for each row execute function private.notify_volume_activity_trigger();

create or replace function private.notify_volume_content_activity_trigger()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status <> 'published' then return new; end if;
  -- Un borrador editado o un cambio técnico en updated_at NO generan avisos.
  if tg_op = 'INSERT' then
    perform private.notify_volume_activity(new.volume_id,'updated');
    return new;
  end if;
  if old.status is distinct from 'published'
    or (new.title, new.content, new.section_type, new.section_number, new.sort_order)
       is distinct from (old.title, old.content, old.section_type, old.section_number, old.sort_order) then
    perform private.notify_volume_activity(new.volume_id,'updated');
  end if;
  return new;
end;
$$;
revoke all on function private.notify_volume_content_activity_trigger()
  from public, anon, authenticated;

-- El disparador anterior enviaba uno por sección: debe dejar de ejecutarse.
drop trigger if exists trg_notify_section_published on public.sections;
drop trigger if exists trg_notify_volume_content_activity on public.sections;
create trigger trg_notify_volume_content_activity
after insert or update of status, title, content, section_type, section_number, sort_order
on public.sections
for each row execute function private.notify_volume_content_activity_trigger();

comment on column public.notifications.volume_id is
  'Volumen específico asociado al aviso de publicación o actualización.';
