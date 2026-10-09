create table if not exists public.reader_collection_saves(
 collection_id uuid not null references public.reader_collections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key(collection_id,user_id)
);
create index if not exists reader_collection_saves_user_idx on public.reader_collection_saves(user_id,created_at desc);
alter table public.reader_collection_saves enable row level security;
grant select,insert,delete on public.reader_collection_saves to authenticated;
create policy collection_saves_own_select on public.reader_collection_saves for select to authenticated using(user_id=(select auth.uid()));
create policy collection_saves_own_insert on public.reader_collection_saves for insert to authenticated with check(user_id=(select auth.uid()) and exists(select 1 from public.reader_collections c where c.id=collection_id and c.is_public and c.user_id<>(select auth.uid())));
create policy collection_saves_own_delete on public.reader_collection_saves for delete to authenticated using(user_id=(select auth.uid()));
create or replace function public.get_public_collection_save_counts()
returns table(collection_id uuid,saves bigint)
language sql stable security definer set search_path='' as $$
 select c.id,count(s.user_id) from public.reader_collections c
 left join public.reader_collection_saves s on s.collection_id=c.id
 where c.is_public group by c.id
$$;
revoke all on function public.get_public_collection_save_counts() from public;
grant execute on function public.get_public_collection_save_counts() to anon,authenticated;