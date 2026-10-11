-- Tres estados editoriales independientes: obra original, traduccion y secuela.
-- Requiere despliegue de esta migracion antes de activar el frontend de la rama.
alter table public.novels
 add column if not exists sequel_status text not null default 'unspecified';

alter table public.novels
 drop constraint if exists novels_sequel_status_check;
alter table public.novels
 add constraint novels_sequel_status_check
 check (sequel_status in ('unspecified','awaiting','unconfirmed','announced','publishing','completed'));

comment on column public.novels.sequel_status is
 'Estado informativo de una posible secuela, independiente del estado de publicacion original y de la traduccion.';

-- No SECURITY DEFINER: las politicas RLS existentes siguen protegiendo ambas tablas.
-- La funcion ejecuta los tres cambios en una sola transaccion.
create or replace function public.update_editorial_states(
 p_translation_id uuid,
 p_novel_status text,
 p_translation_status text,
 p_sequel_status text
) returns void
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_group_id uuid;
 v_novel_id uuid;
begin
 if auth.uid() is null then
   raise exception 'Debes iniciar sesion para modificar estos estados'
     using errcode = '28000';
 end if;

 if p_novel_status not in ('ongoing','completed','hiatus','cancelled')
    or p_translation_status not in ('active','paused','abandoned','complete','withdrawn')
    or p_sequel_status not in ('unspecified','awaiting','unconfirmed','announced','publishing','completed')
    or p_novel_status is null or p_translation_status is null or p_sequel_status is null then
   raise exception 'Uno o mas estados editoriales no son validos'
     using errcode = '22023';
 end if;

 select t.group_id,t.novel_id into v_group_id,v_novel_id
 from public.translations t
 where t.id = p_translation_id
 for update;
 if v_group_id is null then
   raise exception 'Proyecto no disponible'
     using errcode = 'P0002';
 end if;
 if not (private.is_group_editor(v_group_id) or private.is_site_admin()) then
   raise exception 'No tienes permiso para cambiar los estados de este proyecto'
     using errcode = '42501';
 end if;

 update public.novels
 set status=p_novel_status, sequel_status=p_sequel_status, updated_at=now()
 where id=v_novel_id;
 if not found then raise exception 'No se pudo actualizar la obra original' using errcode='42501'; end if;

 update public.translations
 set status=p_translation_status, updated_at=now()
 where id=p_translation_id;
 if not found then raise exception 'No se pudo actualizar el proyecto de traduccion' using errcode='42501'; end if;
end;
$$;

revoke all on function public.update_editorial_states(uuid,text,text,text) from public, anon;
grant execute on function public.update_editorial_states(uuid,text,text,text) to authenticated, service_role;


-- Un cambio de estado editorial es edicion de metadatos, no publicacion de contenido.
-- Conservar el control de CREATE/DELETE y la posibilidad previa de que quienes
-- tienen 'publish' efectuen una transicion, sin alterar el guard de volumenes/capitulos.
create or replace function private.translation_editorial_content_guard()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
declare
 v_group_id uuid;
 v_action text;
begin
 if tg_op = 'DELETE' then
   v_group_id := old.group_id;
   v_action := 'delete';
 elsif tg_op = 'INSERT' then
   v_group_id := new.group_id;
   v_action := 'create';
 else
   v_group_id := new.group_id;
   if new.status is distinct from old.status
      and not private.team_action_allowed(v_group_id,'edit') then
     v_action := 'publish';
   else
     v_action := 'edit';
   end if;
 end if;
 if tg_op = 'DELETE' and v_group_id is null then return old; end if;
 if not (current_user = 'postgres' and auth.uid() is null)
    and not private.team_action_allowed(v_group_id,v_action)
    and not private.is_site_admin() then
   raise exception 'Permiso % denegado para este equipo',v_action
     using errcode = '42501';
 end if;
 if tg_op = 'UPDATE' and new.group_id is distinct from old.group_id
    and not (private.team_action_allowed(old.group_id,'edit') or private.is_site_admin()) then
   raise exception 'No puedes trasladar este proyecto desde su equipo actual'
     using errcode = '42501';
 end if;
 if tg_op='DELETE' then return old; end if;
 return new;
end;
$$;

drop trigger if exists team_guard_translations on public.translations;
create trigger team_guard_translations
before insert or update or delete on public.translations
for each row execute function private.translation_editorial_content_guard();
