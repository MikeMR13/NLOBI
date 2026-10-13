-- NLOBI · Reversión manual de consolidación RLS del 13/10/2026.
-- No ejecutar salvo incidencia reproducible. Reestablece los nombres,
-- roles y expresiones previos a 20261013183000.
begin;

alter policy novels_custom_delete on public.novels to authenticated
using (
  exists (select 1 from public.translations t
    where t.novel_id=novels.id and private.team_action_allowed(t.group_id,'delete'))
);
create policy novels_editor_delete on public.novels for delete to authenticated
using (
  private.is_site_admin()
  or (
    exists (select 1 from public.translations t
      where t.novel_id=novels.id and private.is_group_editor(t.group_id))
    and not exists (select 1 from public.translations t
      where t.novel_id=novels.id and not private.is_group_editor(t.group_id))
  )
);

alter policy translations_custom_delete on public.translations to authenticated
using (private.team_action_allowed(group_id,'delete'));
create policy translations_group_delete on public.translations for delete to authenticated
using (private.is_group_editor(group_id));

alter policy volumes_custom_delete on public.volumes to authenticated
using (exists (select 1 from public.translations t
  where t.id=volumes.translation_id and private.team_action_allowed(t.group_id,'delete')));
create policy volumes_group_delete on public.volumes for delete to authenticated
using (private.is_site_admin() or exists (
  select 1 from public.translations t where t.id=volumes.translation_id
    and private.is_group_editor(t.group_id)));

alter policy sections_custom_delete on public.sections to authenticated
using (exists (
  select 1 from public.volumes v
  join public.translations t on t.id=v.translation_id
  where v.id=sections.volume_id and private.team_action_allowed(t.group_id,'delete')
));
create policy sections_group_delete on public.sections for delete to authenticated
using (private.is_site_admin() or exists (
  select 1 from public.volumes v
  join public.translations t on t.id=v.translation_id
  where v.id=sections.volume_id and private.is_group_editor(t.group_id)));

alter policy volumes_update on public.volumes to authenticated
using (private.is_site_admin() or exists (
  select 1 from public.translations t where t.id=volumes.translation_id
  and private.is_group_editor(t.group_id)))
with check (private.is_site_admin() or exists (
  select 1 from public.translations t where t.id=volumes.translation_id
  and private.is_group_editor(t.group_id)));
create policy volumes_custom_publish on public.volumes for update to authenticated
using (exists (select 1 from public.translations t
  where t.id=volumes.translation_id and private.team_action_allowed(t.group_id,'publish')))
with check (exists (select 1 from public.translations t
  where t.id=volumes.translation_id and private.team_action_allowed(t.group_id,'publish')));

alter policy sections_update on public.sections to authenticated
using (private.is_site_admin() or exists (
  select 1 from public.volumes v join public.translations t on t.id=v.translation_id
  where v.id=sections.volume_id and private.is_group_editor(t.group_id)))
with check (private.is_site_admin() or exists (
  select 1 from public.volumes v join public.translations t on t.id=v.translation_id
  where v.id=sections.volume_id and private.is_group_editor(t.group_id)));
create policy sections_custom_publish on public.sections for update to authenticated
using (exists (
  select 1 from public.volumes v join public.translations t on t.id=v.translation_id
  where v.id=sections.volume_id and private.team_action_allowed(t.group_id,'publish')))
with check (exists (
  select 1 from public.volumes v join public.translations t on t.id=v.translation_id
  where v.id=sections.volume_id and private.team_action_allowed(t.group_id,'publish')));

alter policy translation_collaborations_public_read on public.translation_collaborations
to anon,authenticated;
alter policy translation_collaborations_team_read on public.translation_collaborations
to authenticated
using (private.is_site_admin() or exists (
  select 1 from public.group_members gm
  where gm.user_id=(select auth.uid())
    and gm.group_id=any(array[
      translation_collaborations.inviter_group_id,
      translation_collaborations.invited_group_id
    ])
));
commit;
