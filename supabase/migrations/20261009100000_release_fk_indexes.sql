-- Release performance hardening: cover missing foreign key lookup indexes.
create index if not exists reader_collections_cover_translation_idx on public.reader_collections(cover_translation_id);
create index if not exists translation_review_reports_reporter_idx on public.translation_review_reports(reporter_id);