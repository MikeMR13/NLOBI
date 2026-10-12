-- Studio Fase 5 — bandeja editorial de tareas por equipo.
-- Dependencias: fases 1 y 2, esquema de equipos/permisos existente.
-- No ejecutar en producción sin validar migraciones anteriores y RLS por rol.
create table if not exists public.editorial_tasks (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.translator_groups(id) on delete cascade,
  translation_id uuid references public.translations(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 3 and 180),
  details text not null default '' check (char_length(details) <= 4000),
  status text not null default 'todo'
    check (status in ('todo','in_progress','blocked','done','cancelled')),
  priority text not null default 'normal'
    check (priority in ('normal','high','urgent')),
  assigned_to uuid references auth.users(id) on delete set null,
  created_by uuid not null references auth.users(id),
  due_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists editorial_tasks_group_status_idx
  on public.editorial_tasks(group_id,status,updated_at desc);
create index if not exists editorial_tasks_assigned_idx
  on public.editorial_tasks(assigned_to,status) where assigned_to is not null;
create index if not exists editorial_tasks_translation_idx
  on public.editorial_tasks(translation_id) where translation_id is not null;
create index if not exists editorial_tasks_created_by_idx
  on public.editorial_tasks(created_by);

create or replace function private.validate_editorial_task()
returns trigger language plpgsql set search_path = ''
as $function$
declare
  is_manager boolean;
begin
  if tg_op = 'INSERT' then
    if new.created_by is distinct from auth.uid() and not private.is_site_admin() then
      raise exception 'El autor debe ser el usuario autenticado' using errcode='42501';
    end if;
  else
    if new.group_id is distinct from old.group_id
      or new.created_by is distinct from old.created_by then
      raise exception 'No se puede cambiar el equipo o creador de una tarea' using errcode='42501';
    end if;
    is_manager := private.is_site_admin() or exists (
      select 1 from public.group_members gm
      where gm.group_id=old.group_id and gm.user_id=auth.uid()
        and gm.role in ('owner','admin')
    );
    if not is_manager and old.created_by is distinct from auth.uid()
      and (
        new.title is distinct from old.title or
        new.details is distinct from old.details or
        new.priority is distinct from old.priority or
        new.assigned_to is distinct from old.assigned_to or
        new.due_at is distinct from old.due_at or
        new.translation_id is distinct from old.translation_id
      ) then
      raise exception 'El asignado solo puede cambiar el estado' using errcode='42501';
    end if;
  end if;
  if new.translation_id is not null and not exists (
    select 1 from public.translations t
      where t.id=new.translation_id and t.group_id=new.group_id
  ) then
    raise exception 'La obra no pertenece al equipo seleccionado' using errcode='23514';
  end if;
  if new.assigned_to is not null and not exists (
    select 1 from public.group_members gm
      where gm.group_id=new.group_id and gm.user_id=new.assigned_to
  ) then
    raise exception 'El responsable no pertenece al equipo' using errcode='23514';
  end if;
  new.updated_at := clock_timestamp();
  return new;
end;
$function$;

drop trigger if exists editorial_task_guard on public.editorial_tasks;
create trigger editorial_task_guard
before insert or update on public.editorial_tasks
for each row execute function private.validate_editorial_task();

alter table public.editorial_tasks enable row level security;
drop policy if exists editorial_tasks_team_read on public.editorial_tasks;
create policy editorial_tasks_team_read on public.editorial_tasks
for select to authenticated using (
  private.is_site_admin() or exists (
    select 1 from public.group_members gm
      where gm.group_id=editorial_tasks.group_id and gm.user_id=(select auth.uid())
  )
);
drop policy if exists editorial_tasks_team_create on public.editorial_tasks;
create policy editorial_tasks_team_create on public.editorial_tasks
for insert to authenticated with check (
  created_by=(select auth.uid())
  and (
    private.is_site_admin()
    or private.team_action_allowed(group_id,'edit')
    or private.team_action_allowed(group_id,'create')
    or private.team_action_allowed(group_id,'review')
  )
);
drop policy if exists editorial_tasks_team_update on public.editorial_tasks;
create policy editorial_tasks_team_update on public.editorial_tasks
for update to authenticated
using (
  private.is_site_admin()
  or exists (select 1 from public.group_members gm
       where gm.group_id=editorial_tasks.group_id and gm.user_id=(select auth.uid())
       and gm.role in ('owner','admin'))
  or (created_by=(select auth.uid())
      and (private.team_action_allowed(group_id,'edit')
        or private.team_action_allowed(group_id,'review')
        or private.team_action_allowed(group_id,'create')))
  or (assigned_to=(select auth.uid())
      and (private.team_action_allowed(group_id,'edit')
        or private.team_action_allowed(group_id,'review')))
)
with check (
  private.is_site_admin()
  or exists (select 1 from public.group_members gm
       where gm.group_id=editorial_tasks.group_id and gm.user_id=(select auth.uid())
       and gm.role in ('owner','admin'))
  or (created_by=(select auth.uid())
      and (private.team_action_allowed(group_id,'edit')
        or private.team_action_allowed(group_id,'review')
        or private.team_action_allowed(group_id,'create')))
  or (assigned_to=(select auth.uid())
      and (private.team_action_allowed(group_id,'edit')
        or private.team_action_allowed(group_id,'review')))
);
-- Tareas con historial: no borrado desde la interfaz; usar cancelación.
revoke all on public.editorial_tasks from anon;
grant select,insert,update on public.editorial_tasks to authenticated;
grant all on public.editorial_tasks to service_role;
