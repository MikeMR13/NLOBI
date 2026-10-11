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
