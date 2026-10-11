-- Permitir actualizar solo los estados editoriales de la obra compartida
-- a cualquier integrante con permiso explícito de edición en uno de sus equipos.
-- El resto de metadatos mantiene la protección de TODOS los equipos responsables.
create or replace function private.guard_novel_team_actions()
returns trigger language plpgsql set search_path = ''
as $function$
declare
 responsible record;
 action_name text;
begin
 if private.is_site_admin() then
  if tg_op='DELETE' then return old; end if;
  return new;
 end if;
 if tg_op='UPDATE'
    and (to_jsonb(new) - 'status' - 'sequel_status' - 'updated_at')
        is not distinct from (to_jsonb(old) - 'status' - 'sequel_status' - 'updated_at') then
  if exists(select 1 from public.translations t
            where t.novel_id=old.id and private.team_action_allowed(t.group_id,'edit')) then
   return new;
  end if;
  raise exception 'No tienes permiso para actualizar el estado editorial de esta novela' using errcode='42501';
 end if;
 if tg_op='DELETE' then action_name:='delete';
 else action_name:='edit'; end if;
 for responsible in select distinct group_id from public.translations where novel_id=old.id loop
  if not private.team_action_allowed(responsible.group_id,action_name) then
   raise exception 'No tienes permiso para % esta obra',action_name using errcode='42501';
  end if;
 end loop;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$function$;

drop policy if exists novels_editor_update on public.novels;
create policy novels_editor_update on public.novels
for update to authenticated
using(private.is_site_admin() or exists(
 select 1 from public.translations t where t.novel_id=novels.id
  and private.team_action_allowed(t.group_id,'edit')))
with check(private.is_site_admin() or exists(
 select 1 from public.translations t where t.novel_id=novels.id
  and private.team_action_allowed(t.group_id,'edit')));

drop policy if exists translations_update on public.translations;
create policy translations_update on public.translations
for update to authenticated
using(private.is_site_admin() or private.team_action_allowed(group_id,'edit'))
with check(private.is_site_admin() or private.team_action_allowed(group_id,'edit'));
