-- Solicitudes voluntarias para equipos que activan reclutamiento.
create table if not exists public.group_join_requests (
  id uuid primary key default gen_random_uuid(),
  group_id uuid not null references public.translator_groups(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  message text not null default '' check (char_length(message) <= 1000),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  created_at timestamptz not null default now(),
  reviewed_at timestamptz,
  unique(group_id,user_id)
);
create index if not exists group_join_requests_group_status_idx
  on public.group_join_requests(group_id,status,created_at desc);
alter table public.group_join_requests enable row level security;
revoke all on public.group_join_requests from anon, authenticated;
grant select on public.group_join_requests to authenticated;
grant insert(group_id,user_id,message) on public.group_join_requests to authenticated;
create index if not exists group_join_requests_user_status_idx on public.group_join_requests(user_id,status);
grant update(status,reviewed_at) on public.group_join_requests to authenticated;
create policy "group_join_requests_read" on public.group_join_requests
for select to authenticated
using ((select auth.uid()) = user_id or private.is_group_manager(group_id) or private.is_site_admin());
create policy "group_join_requests_create" on public.group_join_requests
for insert to authenticated
with check (
  (select auth.uid()) = user_id
  and status = 'pending'
  and reviewed_at is null
  and not private.is_group_member(group_id)
  and exists (
    select 1 from public.translator_groups g
    where g.id = group_id and g.profile_settings->>'status' = 'reclutando'
      and coalesce((g.profile_settings->>'show_recruitment')::boolean,true)
  )
);
create policy "group_join_requests_review" on public.group_join_requests
for update to authenticated
using (private.is_group_manager(group_id) or private.is_site_admin())
with check (private.is_group_manager(group_id) or private.is_site_admin());
