-- Studio Fase 7: programación segura, historial editorial y lanzamientos sin avisos duplicados.
-- Requiere PRs Fase 1–6 y todas sus migraciones. NO aplicada a producción.
-- 1. Respetar acceso por equipo y evitar reutilizar programaciones finalizadas.
drop policy if exists volume_schedule_cancel on public.volume_publication_schedule;
create policy volume_schedule_cancel on public.volume_publication_schedule
for update to authenticated
using (private.team_action_allowed(group_id,'schedule') and status='pending')
with check (private.team_action_allowed(group_id,'schedule') and status in ('cancelled','pending'));

create or replace function private.guard_volume_schedule()
returns trigger language plpgsql set search_path = ''
as $function$
begin
 if tg_op='INSERT' then
  if new.scheduled_at<=now()+interval '1 minute' then
   raise exception 'La fecha programada debe ser futura y tener margen de un minuto';
  end if;
  if exists(select 1 from public.volumes where id=new.volume_id and status='published') then
   raise exception 'El volumen ya está publicado';
  end if;
  if exists(select 1 from public.volume_publication_schedule s where s.volume_id=new.volume_id and s.status='pending') then
   raise exception 'Este volumen ya tiene una publicación pendiente';
  end if;
 elsif tg_op='UPDATE' and auth.uid() is not null then
  if old.status<>'pending' or new.status not in ('cancelled','pending')
   or new.volume_id is distinct from old.volume_id
   or new.group_id is distinct from old.group_id
   or new.created_by is distinct from old.created_by
   or new.created_at is distinct from old.created_at
   or new.completed_at is distinct from old.completed_at
   or new.error_message is distinct from old.error_message then
   raise exception 'Solo se permite cancelar o reprogramar una publicación pendiente';
  end if;
  if not private.team_action_allowed(new.group_id,'schedule') then
   raise exception 'Sin permiso para programar publicaciones' using errcode='42501';
  end if;
  if new.status='pending' and (new.scheduled_at<=now()+interval '1 minute' or
      exists(select 1 from public.volumes v where v.id=new.volume_id and v.status='published')) then
   raise exception 'La reprogramación debe ser futura y el volumen no debe estar publicado';
  end if;
 end if;
 return new;
end;
$function$;

-- Evita dos programaciones pendientes creadas simultáneamente.
create unique index if not exists volume_schedule_one_pending_per_volume
on public.volume_publication_schedule(volume_id) where status='pending';

-- 2. Historial privado de publicación. El cliente solo puede consultar sus equipos.
create table if not exists public.editorial_publication_events (
 id uuid primary key default gen_random_uuid(),
 group_id uuid not null references public.translator_groups(id) on delete cascade,
 translation_id uuid references public.translations(id) on delete cascade,
 volume_id uuid references public.volumes(id) on delete cascade,
 section_id uuid references public.sections(id) on delete set null,
 schedule_id uuid references public.volume_publication_schedule(id) on delete set null,
 actor_user_id uuid references auth.users(id) on delete set null,
 event_type text not null check (event_type in (
  'volume_published','volume_hidden','volume_updated',
  'section_published','section_hidden','section_updated',
  'schedule_created','schedule_rescheduled','schedule_cancelled','schedule_failed','schedule_completed'
 )),
 summary text not null check (char_length(summary) between 1 and 300),
 details jsonb not null default '{}'::jsonb,
 created_at timestamptz not null default now()
);
alter table public.editorial_publication_events enable row level security;
create index if not exists editorial_events_project_idx on public.editorial_publication_events(translation_id,created_at desc);
create index if not exists editorial_events_group_idx on public.editorial_publication_events(group_id,created_at desc);
create index if not exists editorial_events_actor_idx on public.editorial_publication_events(actor_user_id) where actor_user_id is not null;
create index if not exists editorial_events_section_idx on public.editorial_publication_events(section_id) where section_id is not null;
create index if not exists editorial_events_schedule_idx on public.editorial_publication_events(schedule_id) where schedule_id is not null;
drop policy if exists editorial_events_team_read on public.editorial_publication_events;
create policy editorial_events_team_read on public.editorial_publication_events
for select to authenticated using (
 private.is_site_admin() or private.is_group_member(group_id)
);
revoke all on public.editorial_publication_events from anon,authenticated;
grant select on public.editorial_publication_events to authenticated;
grant all on public.editorial_publication_events to service_role;

create or replace function private.record_studio_publication_event()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare
 v_group uuid;
 v_translation uuid;
 v_volume uuid;
 v_section uuid;
 v_schedule uuid;
 v_kind text;
 v_label text;
 v_details jsonb := '{}'::jsonb;
 v_previous_schedule timestamptz;
begin
 if tg_table_name='volumes' then
  if tg_op<>'UPDATE' then return new; end if;
  select t.id,t.group_id into v_translation,v_group
   from public.translations t where t.id=new.translation_id;
  v_volume:=new.id;
  if new.status is distinct from old.status then
   v_kind:=case when new.status='published' then 'volume_published' when new.status='hidden' then 'volume_hidden' else 'volume_updated' end;
  elsif new.title is distinct from old.title or new.volume_number is distinct from old.volume_number
      or new.cover_url is distinct from old.cover_url then
   v_kind:='volume_updated';
  else return new; end if;
  v_label:=left('Vol. '||new.volume_number::text||' · '||v_kind,300);
  v_details:=jsonb_build_object('previous_status',old.status,'new_status',new.status,'previous_title',old.title,'title',new.title);
 elsif tg_table_name='sections' then
  if tg_op<>'UPDATE' then return new; end if;
  select v.id,t.id,t.group_id into v_volume,v_translation,v_group
  from public.volumes v join public.translations t on t.id=v.translation_id where v.id=new.volume_id;
  v_section:=new.id;
  if new.status is distinct from old.status then
   v_kind:=case when new.status='published' then 'section_published' when new.status='hidden' then 'section_hidden' else 'section_updated' end;
  elsif new.title is distinct from old.title or new.section_number is distinct from old.section_number
    or new.content is distinct from old.content then v_kind:='section_updated';
  else return new; end if;
  v_label:=left(coalesce(new.title,'Sección')||' · '||v_kind,300);
  v_details:=jsonb_build_object('previous_status',old.status,'new_status',new.status,
   'content_changed',new.content is distinct from old.content);
 elsif tg_table_name='volume_publication_schedule' then
  v_volume:=new.volume_id;
  v_group:=new.group_id;
  v_schedule:=new.id;
  select t.id into v_translation from public.volumes v
   join public.translations t on t.id=v.translation_id where v.id=new.volume_id;
  if tg_op='INSERT' then v_kind:='schedule_created';
  else v_previous_schedule:=old.scheduled_at; end if;
  if tg_op='UPDATE' then
   if new.status is distinct from old.status then
    v_kind:=case new.status when 'cancelled' then 'schedule_cancelled'
      when 'failed' then 'schedule_failed' when 'completed' then 'schedule_completed' else null end;
   elsif new.scheduled_at is distinct from old.scheduled_at then
    v_kind:='schedule_rescheduled';
   else return new; end if;
  end if;
  if v_kind is null then return new; end if;
  v_label:=left('Programación · '||v_kind,300);
  v_details:=jsonb_build_object('scheduled_at',new.scheduled_at,
    'previous_scheduled_at',v_previous_schedule,
    'status',new.status);
 else return new; end if;

 if v_group is not null and v_translation is not null then
  insert into public.editorial_publication_events
   (group_id,translation_id,volume_id,section_id,schedule_id,actor_user_id,event_type,summary,details)
  values(v_group,v_translation,v_volume,v_section,v_schedule,auth.uid(),v_kind,v_label,v_details);
 end if;
 return new;
end;
$function$;
revoke all on function private.record_studio_publication_event() from public,anon,authenticated;

drop trigger if exists studio_publication_audit_volumes on public.volumes;
create trigger studio_publication_audit_volumes
after update on public.volumes for each row execute function private.record_studio_publication_event();
drop trigger if exists studio_publication_audit_sections on public.sections;
create trigger studio_publication_audit_sections
after update on public.sections for each row execute function private.record_studio_publication_event();
drop trigger if exists studio_publication_audit_schedule on public.volume_publication_schedule;
create trigger studio_publication_audit_schedule
after insert or update on public.volume_publication_schedule
for each row execute function private.record_studio_publication_event();

-- 3. Notificación agrupada de nuevos volúmenes a los lectores que siguen la novela,
-- la traducción o el equipo. El índice unique(event_key) existente elimina repeticiones.
create or replace function private.notify_volume_published()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare v_novel uuid; v_group uuid; v_title text;
begin
 if new.status<>'published' or old.status='published' then return new; end if;
 select t.novel_id,t.group_id,n.title into v_novel,v_group,v_title
 from public.translations t join public.novels n on n.id=t.novel_id
 where t.id=new.translation_id;
 insert into public.notifications
  (user_id,notification_type,title,body,translation_id,event_key)
 select distinct f.user_id,'new_publication',
  '¡Nuevo volumen! · '||coalesce(v_title,'Novela'),
  'Volumen '||new.volume_number::text||coalesce(' · '||nullif(new.title,''),''),
  new.translation_id,
  'volume-published:'||new.id::text||':'||f.user_id::text
 from public.follows f
 where ((f.target_type='novel' and f.target_id=v_novel)
  or (f.target_type='translation' and f.target_id=new.translation_id)
  or (f.target_type='translator_group' and f.target_id=v_group))
  and private.notification_enabled(f.user_id,'new_publications')
 on conflict do nothing;
 return new;
end;
$function$;
revoke all on function private.notify_volume_published() from public,anon,authenticated;

drop trigger if exists trg_notify_volume_published on public.volumes;
create trigger trg_notify_volume_published
after update of status on public.volumes
for each row execute function private.notify_volume_published();

-- Restaurar la lógica de notificaciones por capítulo y omitir únicamente las
-- secciones de la publicación en bloque de ESE volumen (no otras obras).
create or replace function private.notify_section_published()
returns trigger language plpgsql security definer set search_path = ''
as $function$
declare tr_id uuid; nv_id uuid; gp_id uuid; work_title text;
begin
 if new.status<>'published' or old.status='published' then return new; end if;
 if current_setting('nlobi.batch_publishing_volume',true)=new.volume_id::text then
  return new;
 end if;
 select t.id,t.novel_id,t.group_id,n.title into tr_id,nv_id,gp_id,work_title
 from public.volumes v join public.translations t on t.id=v.translation_id
 join public.novels n on n.id=t.novel_id where v.id=new.volume_id;
 insert into public.notifications
  (user_id,notification_type,title,body,translation_id,section_id,event_key)
 select distinct f.user_id,'new_publication',
  'Nueva publicación · '||coalesce(work_title,'Novela'),
  coalesce(new.title,'Nueva sección'),tr_id,new.id,
  'section-published:'||new.id::text||':'||f.user_id::text
 from public.follows f
 where ((f.target_type='novel' and f.target_id=nv_id)
  or (f.target_type='translation' and f.target_id=tr_id)
  or (f.target_type='translator_group' and f.target_id=gp_id))
 and private.notification_enabled(f.user_id,'new_publications')
 on conflict do nothing;
 return new;
end;
$function$;

-- Actualiza la función de publicación sin alterar sus permisos ni sus garantías
-- transaccionales: un solo RPC publica el volumen y todas sus secciones.
create or replace function public.publish_volume_with_sections(p_volume_id uuid)
returns integer language plpgsql security invoker set search_path = ''
as $function$
declare v_rows integer; v_sections integer;
begin
 perform set_config('nlobi.batch_publishing_volume',p_volume_id::text,true);
 update public.volumes
 set status='published',
     published_at=case when status='published' and published_at is not null then published_at else now() end,
     updated_at=now()
 where id=p_volume_id;
 get diagnostics v_rows=row_count;
 if v_rows<>1 then raise exception 'Volume not found or editorial permission required'; end if;
 update public.sections
 set status='published',
     published_at=case when status='published' and published_at is not null then published_at else now() end,
     updated_at=now()
 where volume_id=p_volume_id;
 get diagnostics v_sections=row_count;
 return v_sections;
end;
$function$;
revoke all on function public.publish_volume_with_sections(uuid) from public,anon;
grant execute on function public.publish_volume_with_sections(uuid) to authenticated,service_role;

-- IMPORTANT: los eventos se retienen al borrar secciones para auditoría de volúmenes;
-- al borrar volumen/proyecto se depuran vía FK CASCADE, en línea con la política editorial.
