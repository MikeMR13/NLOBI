create table if not exists public.reader_collections(
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id) on delete cascade,
 title text not null check(char_length(trim(title)) between 3 and 80),
 description text not null default '' check(char_length(description)<=500),
 is_public boolean not null default false,
 created_at timestamptz not null default now(),updated_at timestamptz not null default now()
);
create index if not exists reader_collections_user_idx on public.reader_collections(user_id,updated_at desc);
create table if not exists public.reader_collection_items(
 collection_id uuid not null references public.reader_collections(id) on delete cascade,
 translation_id uuid not null references public.translations(id) on delete cascade,
 created_at timestamptz not null default now(),primary key(collection_id,translation_id)
);
create index if not exists reader_collection_items_translation_idx on public.reader_collection_items(translation_id);
alter table public.reader_collections enable row level security;
alter table public.reader_collection_items enable row level security;
grant select,insert,update,delete on public.reader_collections to authenticated;
grant select,insert,delete on public.reader_collection_items to authenticated;
grant select on public.reader_collections,public.reader_collection_items to anon;
create policy collections_select on public.reader_collections for select using(user_id=(select auth.uid()) or is_public);
create policy collections_insert on public.reader_collections for insert to authenticated with check(user_id=(select auth.uid()));
create policy collections_update on public.reader_collections for update to authenticated using(user_id=(select auth.uid())) with check(user_id=(select auth.uid()));
create policy collections_delete on public.reader_collections for delete to authenticated using(user_id=(select auth.uid()));
create policy collection_items_select on public.reader_collection_items for select using(exists(select 1 from public.reader_collections c where c.id=collection_id and (c.user_id=(select auth.uid()) or c.is_public)));
create policy collection_items_insert on public.reader_collection_items for insert to authenticated with check(exists(select 1 from public.reader_collections c where c.id=collection_id and c.user_id=(select auth.uid())) and exists(select 1 from public.translations t where t.id=translation_id and t.status in ('active','complete','paused')));
create policy collection_items_delete on public.reader_collection_items for delete to authenticated using(exists(select 1 from public.reader_collections c where c.id=collection_id and c.user_id=(select auth.uid())));
