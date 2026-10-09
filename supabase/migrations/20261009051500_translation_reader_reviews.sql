-- Reader reviews: one written review per reader and translation.
create table if not exists public.translation_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id uuid not null references public.translations(id) on delete cascade,
  body text not null check (char_length(btrim(body)) between 20 and 3000),
  contains_spoilers boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, translation_id)
);

create index if not exists translation_reviews_translation_idx
  on public.translation_reviews(translation_id, updated_at desc);

alter table public.translation_reviews enable row level security;

drop policy if exists translation_reviews_read_own on public.translation_reviews;
create policy translation_reviews_read_own
  on public.translation_reviews
  for select to authenticated
  using (user_id=(select auth.uid()));

drop policy if exists translation_reviews_insert_own on public.translation_reviews;
create policy translation_reviews_insert_own
  on public.translation_reviews
  for insert to authenticated
  with check (
    user_id=(select auth.uid())
    and exists (
      select 1
      from public.translations t
      where t.id=translation_id
        and t.status in ('active','complete','paused')
    )
  );

drop policy if exists translation_reviews_update_own on public.translation_reviews;
create policy translation_reviews_update_own
  on public.translation_reviews
  for update to authenticated
  using (user_id=(select auth.uid()))
  with check (
    user_id=(select auth.uid())
    and char_length(btrim(body)) between 20 and 3000
  );

drop policy if exists translation_reviews_delete_own on public.translation_reviews;
create policy translation_reviews_delete_own
  on public.translation_reviews
  for delete to authenticated
  using (user_id=(select auth.uid()));

grant select,insert,update,delete on public.translation_reviews to authenticated;

-- Public reader-facing projection. Individual reviews are exposed only for
-- translations that are currently public, without granting anonymous access
-- to the underlying table.
create or replace function public.get_translation_reviews(p_translation_id uuid)
returns table (
  id uuid,
  user_id uuid,
  display_name text,
  username text,
  avatar_url text,
  body text,
  contains_spoilers boolean,
  created_at timestamptz,
  updated_at timestamptz
)
language sql
stable
security definer
set search_path=''
as $$
  select
    r.id,
    r.user_id,
    p.display_name,
    p.username,
    p.avatar_url,
    r.body,
    r.contains_spoilers,
    r.created_at,
    r.updated_at
  from public.translation_reviews r
  join public.translations t on t.id=r.translation_id
  left join public.profiles p on p.id=r.user_id
  where r.translation_id=p_translation_id
    and t.status in ('active','complete','paused')
  order by r.updated_at desc, r.created_at desc
$$;

revoke all on function public.get_translation_reviews(uuid) from public;
grant execute on function public.get_translation_reviews(uuid) to anon,authenticated;
