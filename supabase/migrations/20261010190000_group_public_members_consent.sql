create table if not exists public.group_public_members (
 group_id uuid not null references public.translator_groups(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 consented_at timestamptz not null default now(),
 primary key (group_id,user_id)
);
alter table public.group_public_members enable row level security;
revoke all on public.group_public_members from anon,authenticated;
grant select on public.group_public_members to anon,authenticated;
grant insert(group_id,user_id) on public.group_public_members to authenticated;
grant delete on public.group_public_members to authenticated;
create policy "public_members_read" on public.group_public_members for select to anon,authenticated using (true);
create policy "public_members_consent" on public.group_public_members for insert to authenticated with check ((select auth.uid())=user_id and private.is_group_member(group_id));
create policy "public_members_revoke" on public.group_public_members for delete to authenticated using ((select auth.uid())=user_id);
