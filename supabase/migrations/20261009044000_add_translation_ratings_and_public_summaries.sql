-- Reader ratings: one 1–5 star score per account and translation.
create table if not exists public.translation_ratings (
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id uuid not null references public.translations(id) on delete cascade,
  stars smallint not null check (stars between 1 and 5),
  updated_at timestamptz not null default now(),
  primary key (user_id, translation_id)
);
create index if not exists translation_ratings_translation_idx on public.translation_ratings(translation_id);
alter table public.translation_ratings enable row level security;
drop policy if exists ratings_read_own on public.translation_ratings;
create policy ratings_read_own on public.translation_ratings for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists ratings_insert_own on public.translation_ratings;
create policy ratings_insert_own on public.translation_ratings for insert to authenticated
  with check (user_id=(select auth.uid()) and exists (select 1 from public.translations t where t.id=translation_id and t.status in ('active','complete','paused')));
drop policy if exists ratings_update_own on public.translation_ratings;
create policy ratings_update_own on public.translation_ratings for update to authenticated
  using (user_id=(select auth.uid())) with check (user_id=(select auth.uid()) and stars between 1 and 5);
drop policy if exists ratings_delete_own on public.translation_ratings;
create policy ratings_delete_own on public.translation_ratings for delete to authenticated using (user_id=(select auth.uid()));
grant select,insert,update,delete on public.translation_ratings to authenticated;

-- Public aggregates without exposing individual votes or reader IDs.
create or replace function public.get_translation_rating_summaries()
returns table (translation_id uuid, average_rating numeric, ratings_count bigint)
language sql stable security definer set search_path='' as $$
  select r.translation_id, round(avg(r.stars)::numeric,2), count(*)
  from public.translation_ratings r
  join public.translations t on t.id=r.translation_id
  where t.status in ('active','complete','paused')
  group by r.translation_id
$$;
revoke all on function public.get_translation_rating_summaries() from public;
grant execute on function public.get_translation_rating_summaries() to anon,authenticated;
