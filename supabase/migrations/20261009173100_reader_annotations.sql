-- NLOBI reader phase 8: personal highlights, notes, and multiple bookmarks.
create table if not exists public.reader_annotations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  translation_id uuid not null references public.translations(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  kind text not null check (kind in ('bookmark','highlight','note')),
  anchor_mode text not null check (anchor_mode in ('block','text')),
  start_block integer not null check (start_block between 0 and 99999),
  start_offset integer not null check (start_offset between 0 and 1000000),
  end_block integer check (end_block between 0 and 99999),
  end_offset integer check (end_offset between 0 and 1000000),
  excerpt text not null default '' check (char_length(excerpt) <= 1200),
  note text not null default '' check (char_length(note) <= 4000),
  color text not null default 'amber' check (color in ('amber','mint','rose','blue')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint reader_annotation_text_range check (
    (anchor_mode = 'block' and end_block is null and end_offset is null)
    or (anchor_mode = 'text' and end_block is not null and end_offset is not null
      and (end_block > start_block or (end_block = start_block and end_offset > start_offset)))
  )
);
create index if not exists reader_annotations_user_recent_idx
  on public.reader_annotations (user_id, created_at desc);
create index if not exists reader_annotations_user_section_idx
  on public.reader_annotations (user_id, section_id, created_at desc);
alter table public.reader_annotations enable row level security;
revoke all on public.reader_annotations from public, anon;
grant select, insert, update, delete on public.reader_annotations to authenticated;
create policy "reader_annotations_select_own" on public.reader_annotations
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "reader_annotations_insert_own" on public.reader_annotations
 for insert to authenticated with check ((select auth.uid()) = user_id);
create policy "reader_annotations_update_own" on public.reader_annotations
 for update to authenticated using ((select auth.uid()) = user_id)
 with check ((select auth.uid()) = user_id);
create policy "reader_annotations_delete_own" on public.reader_annotations
 for delete to authenticated using ((select auth.uid()) = user_id);
