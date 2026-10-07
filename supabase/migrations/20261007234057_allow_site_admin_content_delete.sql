-- Applied to Supabase production as migration 20261007234057.
drop policy if exists sections_group_delete on public.sections;
create policy sections_group_delete
on public.sections for delete
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1
    from public.volumes v
    join public.translations t on t.id = v.translation_id
    where v.id = sections.volume_id
      and private.is_group_editor(t.group_id)
  )
);

drop policy if exists volumes_group_delete on public.volumes;
create policy volumes_group_delete
on public.volumes for delete
to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1
    from public.translations t
    where t.id = volumes.translation_id
      and private.is_group_editor(t.group_id)
  )
);
