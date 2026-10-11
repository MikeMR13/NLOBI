-- Studio: states of the original novel and its translations are editable by the
-- corresponding translator team's members with the "edit" permission.
--
-- Original novel status is shared metadata; only status/updated_at may be changed
-- by ONE of the responsible translation teams. Changes to any other novel fields
-- continue to require edit rights on ALL associated translation teams.
-- Existing publication and editorial review guards for sections/volumes remain.
-- Apply after the existing Studio phase 1/2 migrations, before deploying Studio.

create or replace function private.team_content_guard()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  gid uuid;
  action_name text;
  vid uuid;
  tid uuid;
begin
  if tg_table_name = 'sections' then
    if tg_op = 'DELETE' then vid := old.volume_id;
    else vid := new.volume_id; end if;
    select t.group_id into gid
      from public.volumes v
      join public.translations t on t.id = v.translation_id
     where v.id = vid;
  elsif tg_table_name = 'volumes' then
    if tg_op = 'DELETE' then tid := old.translation_id;
    else tid := new.translation_id; end if;
    select group_id into gid from public.translations where id = tid;
  else
    if tg_op = 'DELETE' then gid := old.group_id;
    else gid := new.group_id; end if;
  end if;

  if gid is null and tg_op = 'DELETE' then return old; end if;

  if tg_op = 'DELETE' then
    action_name := 'delete';
  elsif tg_op = 'INSERT' then
    action_name := 'create';
  elsif tg_op = 'UPDATE' then
    -- A translation's "status" is editorial metadata, not a request to
    -- publish sections. It should need EDIT permission, not PUBLISH.
    if tg_table_name in ('sections','volumes')
       and new.status is distinct from old.status then
      if tg_table_name = 'sections' then
        if (new.title,new.content,new.section_type,new.section_number,new.sort_order)
            is distinct from
           (old.title,old.content,old.section_type,old.section_number,old.sort_order)
           and not private.team_action_allowed(gid,'edit') then
          raise exception 'No puedes editar el capítulo durante su publicación';
        end if;
      elsif tg_table_name = 'volumes' then
        if (new.title,new.cover_url,new.volume_number)
           is distinct from
           (old.title,old.cover_url,old.volume_number)
           and not private.team_action_allowed(gid,'edit') then
          raise exception 'No puedes editar el volumen durante su publicación';
        end if;
      end if;
      action_name := 'publish';
    else
      action_name := 'edit';
    end if;
  end if;

  if not (current_user = 'postgres' and auth.uid() is null)
     and not private.team_action_allowed(gid,action_name)
     and not private.is_site_admin() then
    raise exception 'Permiso % denegado para este equipo',action_name
      using errcode='42501';
  end if;
  if tg_op = 'DELETE' then return old;
  else return new; end if;
end
$function$;

create or replace function private.guard_novel_team_actions()
returns trigger
language plpgsql
set search_path = ''
as $function$
declare
  responsible record;
  action_name text;
begin
  if private.is_site_admin() then
    if tg_op = 'DELETE' then return old; end if;
    return new;
  end if;

  if tg_op = 'UPDATE'
     and (to_jsonb(new) - 'status' - 'updated_at')
         is not distinct from
         (to_jsonb(old) - 'status' - 'updated_at') then
    -- Allow any team currently translating the original novel to maintain
    -- its publication lifecycle, without requiring membership in OTHER teams.
    if exists (
      select 1 from public.translations t
       where t.novel_id = old.id
         and private.team_action_allowed(t.group_id,'edit')
    ) then
      return new;
    end if;
    raise exception 'No tienes permiso editorial para cambiar el estado de esta novela'
      using errcode='42501';
  end if;

  if tg_op = 'DELETE' then action_name := 'delete';
  else action_name := 'edit'; end if;

  -- Preserve the multi-team safeguard for titles, synopses, classifications,
  -- deletion, and other shared original-novel metadata.
  for responsible in
    select distinct group_id
      from public.translations
     where novel_id = old.id
  loop
    if not private.team_action_allowed(responsible.group_id,action_name) then
      raise exception 'No tienes permiso para % esta obra',action_name
        using errcode='42501';
    end if;
  end loop;

  if tg_op = 'DELETE' then return old; end if;
  return new;
end
$function$;

drop policy if exists translations_update on public.translations;
create policy translations_update
  on public.translations
  for update to authenticated
  using (private.is_site_admin() or private.team_action_allowed(group_id,'edit'))
  with check (private.is_site_admin() or private.team_action_allowed(group_id,'edit'));

drop policy if exists novels_editor_update on public.novels;
create policy novels_editor_update
  on public.novels
  for update to authenticated
  using (
    private.is_site_admin()
    or exists(
      select 1 from public.translations t
       where t.novel_id = novels.id
         and private.team_action_allowed(t.group_id,'edit')
    )
  )
  with check (
    private.is_site_admin()
    or exists(
      select 1 from public.translations t
       where t.novel_id = novels.id
         and private.team_action_allowed(t.group_id,'edit')
    )
  );

-- Authenticated already has SELECT/UPDATE table grants in the deployed schema.
-- Do not expand grants here; RLS and protected triggers govern changes.
