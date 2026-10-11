-- Phase 5: low-risk Postgres performance fixes identified by Supabase advisors.
-- Safe to apply after QA; deliberately not executed on production by this PR.
-- Preserve existing row ownership checks and policy names.
create index if not exists reader_annotations_section_id_idx
  on public.reader_annotations (section_id);

create index if not exists reader_annotations_translation_id_idx
  on public.reader_annotations (translation_id);

alter policy "Readers insert own UI preferences"
  on public.reader_ui_preferences
  with check ((select auth.uid()) = user_id);

alter policy "Readers update own UI preferences"
  on public.reader_ui_preferences
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);

alter policy "Readers view own UI preferences"
  on public.reader_ui_preferences
  using ((select auth.uid()) = user_id);
