-- Production migration: per-user completed chapters.
create table if not exists public.read_sections (
  user_id uuid not null references auth.users(id) on delete cascade,
  section_id uuid not null references public.sections(id) on delete cascade,
  read_at timestamptz not null default now(),
  primary key (user_id,section_id)
);
alter table public.read_sections enable row level security;
create policy "Users read their chapter completions" on public.read_sections
 for select to authenticated using ((select auth.uid()) = user_id);
create policy "Users mark their own chapters completed" on public.read_sections
 for insert to authenticated with check ((select auth.uid()) = user_id);
grant select,insert on public.read_sections to authenticated;
