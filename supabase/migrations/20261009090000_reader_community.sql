-- Reader community: independent profile follows and opt-in reader discovery.
alter table public.profiles add column if not exists discoverable_reader boolean not null default false;

create table if not exists public.reader_follows (
 follower_id uuid not null references auth.users(id) on delete cascade,
 followed_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (follower_id, followed_id),
 constraint reader_follows_no_self check (follower_id <> followed_id)
);
create index if not exists reader_follows_followed_id_idx on public.reader_follows(followed_id, created_at desc);
alter table public.reader_follows enable row level security;
revoke all on public.reader_follows from anon;
grant select,insert,delete on public.reader_follows to authenticated;

drop policy if exists reader_follows_select_own on public.reader_follows;
create policy reader_follows_select_own on public.reader_follows for select to authenticated
using (follower_id = (select auth.uid()));

drop policy if exists reader_follows_insert_own on public.reader_follows;
create policy reader_follows_insert_own on public.reader_follows for insert to authenticated
with check (
  follower_id = (select auth.uid())
  and followed_id <> (select auth.uid())
  and exists (select 1 from public.profiles p where p.id = followed_id)
);

drop policy if exists reader_follows_delete_own on public.reader_follows;
create policy reader_follows_delete_own on public.reader_follows for delete to authenticated
using (follower_id = (select auth.uid()));

-- Aggregate only. Raw follower relationships remain private to the follower.
create or replace function public.get_reader_social_counts(p_reader_id uuid)
returns table(followers bigint, following bigint)
language sql stable security definer set search_path = '' as $$
select
 (select count(*) from public.reader_follows f where f.followed_id=p_reader_id),
 (select count(*) from public.reader_follows f where f.follower_id=p_reader_id)
where exists(select 1 from public.profiles p where p.id=p_reader_id)
$$;
revoke all on function public.get_reader_social_counts(uuid) from public;
grant execute on function public.get_reader_social_counts(uuid) to anon,authenticated;

-- Discovery uses exclusively opt-in profiles and genres from their explicitly
-- shared collections or library. Private reading records never contribute.
create or replace function public.get_discoverable_readers()
returns table(
 reader_id uuid,username text,display_name text,avatar_url text,bio text,
 public_library boolean,public_activity boolean,
 favorite_genres text[],followers bigint,public_collections bigint,public_reviews bigint
)
language sql stable security definer set search_path = '' as $$
select p.id,p.username,p.display_name,p.avatar_url,left(coalesce(p.bio,''),300),
 p.public_library,p.public_activity,
 coalesce((
  select array_agg(distinct g.genre order by g.genre) from (
   select unnest(n.genres) as genre
   from public.reader_collections c
   join public.reader_collection_items i on i.collection_id=c.id
   join public.translations t on t.id=i.translation_id and t.status in ('active','complete','paused')
   join public.novels n on n.id=t.novel_id
   where c.user_id=p.id and c.is_public
   union all
   select unnest(n.genres) as genre
   from public.library_entries le
   join public.translations t on t.id=le.translation_id and t.status in ('active','complete','paused')
   join public.novels n on n.id=t.novel_id
   where le.user_id=p.id and p.public_library
  ) g where nullif(trim(g.genre),'') is not null
 ), '{}'::text[]),
 (select count(*) from public.reader_follows f where f.followed_id=p.id),
 (select count(*) from public.reader_collections c where c.user_id=p.id and c.is_public),
 (select count(*) from public.translation_reviews r
   join public.translations t on t.id=r.translation_id
   where r.user_id=p.id and t.status in ('active','complete','paused'))
from public.profiles p
where p.discoverable_reader=true
order by p.updated_at desc,p.id
limit 200
$$;
revoke all on function public.get_discoverable_readers() from public;
grant execute on function public.get_discoverable_readers() to anon,authenticated;
