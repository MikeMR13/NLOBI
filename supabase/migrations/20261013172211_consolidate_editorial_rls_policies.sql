-- NLOBI · Consolidación conservadora de políticas RLS permisivas.
-- Alinear la capa RLS con los permisos granulares; los triggers de control
-- (team_content_guard, translation_editorial_content_guard y guard_novel_team_actions)
-- continúan exigiendo las autorizaciones precisas en cada cambio.
-- No modifica datos, funciones RPC, autenticación ni acceso al lector.
--
-- Evita políticas OR redundantes: una política por tabla/acción/rol.
-- DROP POLICY se ejecuta en la misma transacción que ALTER POLICY.
begin;

-- Novelas: el permiso de eliminación depende de cada equipo responsable.
-- La comprobación ALL de equipos colaboradores sigue en guard_novel_team_actions.
alter policy novels_custom_delete on public.novels
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.translations t
    where t.novel_id=novels.id
      and private.team_action_allowed(t.group_id,'delete')
  )
);
drop policy novels_editor_delete on public.novels;

-- Traducciones: no permitir que el permiso de editar sea suficiente para borrar.
alter policy translations_custom_delete on public.translations
to authenticated
using (
  private.is_site_admin()
  or private.team_action_allowed(group_id,'delete')
);
drop policy translations_group_delete on public.translations;

-- Volúmenes: separar permiso de borrado de permiso de edición.
alter policy volumes_custom_delete on public.volumes
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.translations t
    where t.id=volumes.translation_id
      and private.team_action_allowed(t.group_id,'delete')
  )
);
drop policy volumes_group_delete on public.volumes;

-- Capítulos: misma separación de permisos.
alter policy sections_custom_delete on public.sections
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.volumes v
    join public.translations t on t.id=v.translation_id
    where v.id=sections.volume_id
      and private.team_action_allowed(t.group_id,'delete')
  )
);
drop policy sections_group_delete on public.sections;

-- UPDATE: debe admitir a quien tenga editar O publicar, sin crear
-- dos políticas permisivas superpuestas. Los triggers revisan la operación
-- concreta y rechazan editar contenido sin permiso o publicar sin permiso.
alter policy volumes_update on public.volumes
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.translations t
    where t.id=volumes.translation_id
      and (
        private.is_group_editor(t.group_id)
        or private.team_action_allowed(t.group_id,'publish')
      )
  )
)
with check (
  private.is_site_admin()
  or exists (
    select 1 from public.translations t
    where t.id=volumes.translation_id
      and (
        private.is_group_editor(t.group_id)
        or private.team_action_allowed(t.group_id,'publish')
      )
  )
);
drop policy volumes_custom_publish on public.volumes;

alter policy sections_update on public.sections
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.volumes v
    join public.translations t on t.id=v.translation_id
    where v.id=sections.volume_id
      and (
        private.is_group_editor(t.group_id)
        or private.team_action_allowed(t.group_id,'publish')
      )
  )
)
with check (
  private.is_site_admin()
  or exists (
    select 1 from public.volumes v
    join public.translations t on t.id=v.translation_id
    where v.id=sections.volume_id
      and (
        private.is_group_editor(t.group_id)
        or private.team_action_allowed(t.group_id,'publish')
      )
  )
);
drop policy sections_custom_publish on public.sections;

-- Colaboraciones: invitados ven colaboraciones aceptadas; integrantes y
-- administrador también las pendientes de sus equipos. Una sola política
-- SELECT por rol elimina el OR redundante sin cambiar la visibilidad.
alter policy translation_collaborations_public_read on public.translation_collaborations
to anon;

alter policy translation_collaborations_team_read on public.translation_collaborations
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.group_members gm
    where gm.user_id=(select auth.uid())
      and gm.group_id=any(array[
        translation_collaborations.inviter_group_id,
        translation_collaborations.invited_group_id
      ])
  )
  or (
    status='accepted'
    and exists (
      select 1 from public.translations t
      where t.id=translation_collaborations.translation_id
        and t.status in ('active','complete','paused')
    )
  )
);
commit;
