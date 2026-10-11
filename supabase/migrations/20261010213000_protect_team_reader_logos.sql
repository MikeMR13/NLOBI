-- Prevent reader-specific PNGs from being classified as orphan media.
-- The same reference must be recognized by Storage delete guards and the media library.
create or replace function private.storage_object_reference_count(p_path text)
returns bigint
language sql
stable security definer
set search_path = ''
as $function$
  select
    (select count(*) from public.novels n where n.cover_url like '%' || p_path || '%') +
    (select count(*) from public.volumes v where v.cover_url like '%' || p_path || '%') +
    (select count(*) from public.profiles p where p.avatar_url like '%' || p_path || '%') +
    (select count(*) from public.translator_groups g
      where g.avatar_url like '%' || p_path || '%'
         or g.banner_url like '%' || p_path || '%'
         or (g.profile_settings ->> 'reader_logo_url') like '%' || p_path || '%'
         or (g.profile_settings ->> 'background_image') like '%' || p_path || '%') +
    (select count(*) from public.sections s where s.content::text like '%' || p_path || '%') +
    (select count(*) from public.section_revisions r where r.content::text like '%' || p_path || '%');
$function$;

create or replace function public.media_usage_for_paths(p_paths text[])
returns table(path text, reference_count bigint)
language plpgsql
stable
set search_path = ''
as $function$
begin
  if auth.uid() is null then
    raise exception 'authentication required';
  end if;
  return query
    select p, (
      (select count(*) from public.novels n where n.cover_url like '%' || p || '%') +
      (select count(*) from public.volumes v where v.cover_url like '%' || p || '%') +
      (select count(*) from public.profiles pr where pr.avatar_url like '%' || p || '%') +
      (select count(*) from public.translator_groups g
        where g.avatar_url like '%' || p || '%'
           or g.banner_url like '%' || p || '%'
           or (g.profile_settings ->> 'reader_logo_url') like '%' || p || '%'
           or (g.profile_settings ->> 'background_image') like '%' || p || '%') +
      (select count(*) from public.sections s where s.content::text like '%' || p || '%') +
      (select count(*) from public.section_revisions r where r.content::text like '%' || p || '%')
    )::bigint
    from unnest(coalesce(p_paths, array[]::text[])) as p
    where (
      split_part(p,'/',1) = 'users'
      and split_part(p,'/',2) = (select auth.uid())::text
    ) or (
      split_part(p,'/',1) = 'teams'
      and split_part(p,'/',2) ~* '^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$'
      and exists (
        select 1 from public.group_members gm
        where gm.group_id = split_part(p,'/',2)::uuid
          and gm.user_id = (select auth.uid())
          and gm.role in ('owner','admin','translator','editor')
      )
    );
end;
$function$;

-- Team identity and reader presentation can only be changed by owner/admin.
-- Content editor permissions remain unchanged in their own tables.
drop policy if exists "groups_update_editors" on public.translator_groups;
drop policy if exists "groups_update_managers" on public.translator_groups;
create policy "groups_update_managers"
  on public.translator_groups for update to authenticated
  using (private.is_group_manager(id))
  with check (private.is_group_manager(id));
