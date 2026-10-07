-- Applied to Supabase production as migration 20261007215045.
-- Security/integrity hardening discovered during the full production audit.

revoke insert, update, delete, truncate, references, trigger on all tables in schema public from anon;
revoke truncate, references, trigger on all tables in schema public from authenticated;
alter default privileges in schema public revoke insert, update, delete, truncate, references, trigger on tables from anon;
alter default privileges in schema public revoke truncate, references, trigger on tables from authenticated;

drop policy if exists novels_team_member_insert on public.novels;
drop policy if exists novels_editor_insert on public.novels;
create policy novels_editor_insert on public.novels for insert to authenticated
with check (
  private.is_site_admin()
  or exists (
    select 1 from public.group_members gm
    where gm.user_id = (select auth.uid())
      and gm.role in ('owner','admin','translator','editor')
  )
);

drop policy if exists novels_editor_update on public.novels;
create policy novels_editor_update on public.novels for update to authenticated
using (
  private.is_site_admin()
  or exists (
    select 1 from public.translations t
    where t.novel_id = novels.id and private.is_group_editor(t.group_id)
  )
)
with check (
  private.is_site_admin()
  or exists (
    select 1 from public.translations t
    where t.novel_id = novels.id and private.is_group_editor(t.group_id)
  )
);

drop policy if exists purchase_group_insert on public.purchase_links;
create policy purchase_group_insert on public.purchase_links for insert to authenticated
with check (
  private.is_site_admin()
  or (
    group_id is not null
    and private.is_group_editor(group_id)
    and exists (
      select 1 from public.translations t
      where t.novel_id = purchase_links.novel_id
        and t.group_id = purchase_links.group_id
    )
  )
);

drop policy if exists purchase_group_update on public.purchase_links;
create policy purchase_group_update on public.purchase_links for update to authenticated
using (
  private.is_site_admin()
  or (group_id is not null and private.is_group_editor(group_id))
)
with check (
  private.is_site_admin()
  or (
    group_id is not null
    and private.is_group_editor(group_id)
    and exists (
      select 1 from public.translations t
      where t.novel_id = purchase_links.novel_id
        and t.group_id = purchase_links.group_id
    )
  )
);

drop policy if exists purchase_anon_read on public.purchase_links;
create policy purchase_anon_read on public.purchase_links for select to anon
using (
  is_verified = true
  and exists (
    select 1 from public.translations t
    where t.novel_id = purchase_links.novel_id
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists comments_self_insert on public.comments;
create policy comments_self_insert on public.comments for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.sections s
    join public.volumes v on v.id = s.volume_id
    join public.translations t on t.id = v.translation_id
    where s.id = comments.section_id
      and s.status = 'published'
      and v.status = 'published'
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists comments_self_update on public.comments;
create policy comments_self_update on public.comments for update to authenticated
using ((select auth.uid()) = user_id)
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.sections s
    join public.volumes v on v.id = s.volume_id
    join public.translations t on t.id = v.translation_id
    where s.id = comments.section_id
      and s.status = 'published'
      and v.status = 'published'
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists comment_reactions_public_read on public.comment_reactions;
create policy comment_reactions_public_read on public.comment_reactions for select to public
using (
  exists (
    select 1
    from public.comments c
    join public.sections s on s.id = c.section_id
    join public.volumes v on v.id = s.volume_id
    join public.translations t on t.id = v.translation_id
    where c.id = comment_reactions.comment_id
      and s.status = 'published'
      and v.status = 'published'
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists comment_reactions_own_insert on public.comment_reactions;
create policy comment_reactions_own_insert on public.comment_reactions for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and exists (
    select 1
    from public.comments c
    join public.sections s on s.id = c.section_id
    join public.volumes v on v.id = s.volume_id
    join public.translations t on t.id = v.translation_id
    where c.id = comment_reactions.comment_id
      and s.status = 'published'
      and v.status = 'published'
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists comment_reports_own_insert on public.comment_reports;
create policy comment_reports_own_insert on public.comment_reports for insert to authenticated
with check (
  (select auth.uid()) = reporter_id
  and exists (
    select 1
    from public.comments c
    join public.sections s on s.id = c.section_id
    join public.volumes v on v.id = s.volume_id
    join public.translations t on t.id = v.translation_id
    where c.id = comment_reports.comment_id
      and s.status = 'published'
      and v.status = 'published'
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists library_public_select on public.library_entries;
create policy library_public_select on public.library_entries for select to anon
using (
  exists (
    select 1 from public.profiles p
    where p.id = library_entries.user_id and p.public_library = true
  )
  and exists (
    select 1 from public.translations t
    where t.id = library_entries.translation_id
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists library_select on public.library_entries;
create policy library_select on public.library_entries for select to authenticated
using (
  (select auth.uid()) = user_id
  or (
    exists (
      select 1 from public.profiles p
      where p.id = library_entries.user_id and p.public_library = true
    )
    and exists (
      select 1 from public.translations t
      where t.id = library_entries.translation_id
        and t.status in ('active','complete','paused')
    )
  )
);

drop policy if exists progress_public_select on public.reading_progress;
create policy progress_public_select on public.reading_progress for select to anon
using (
  exists (
    select 1 from public.profiles p
    where p.id = reading_progress.user_id and p.public_activity = true
  )
  and exists (
    select 1 from public.translations t
    where t.id = reading_progress.translation_id
      and t.status in ('active','complete','paused')
  )
);

drop policy if exists progress_select on public.reading_progress;
create policy progress_select on public.reading_progress for select to authenticated
using (
  (select auth.uid()) = user_id
  or (
    exists (
      select 1 from public.profiles p
      where p.id = reading_progress.user_id and p.public_activity = true
    )
    and exists (
      select 1 from public.translations t
      where t.id = reading_progress.translation_id
        and t.status in ('active','complete','paused')
    )
  )
);
