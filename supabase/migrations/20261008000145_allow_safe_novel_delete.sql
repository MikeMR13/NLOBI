-- Applied to Supabase production as migration 20261008000145.
grant delete on public.novels to authenticated;

drop policy if exists novels_editor_delete on public.novels;
create policy novels_editor_delete
on public.novels for delete
to authenticated
using (
  private.is_site_admin()
  or (
    exists (
      select 1
      from public.translations t
      where t.novel_id = novels.id
        and private.is_group_editor(t.group_id)
    )
    and not exists (
      select 1
      from public.translations t
      where t.novel_id = novels.id
        and not private.is_group_editor(t.group_id)
    )
  )
);
