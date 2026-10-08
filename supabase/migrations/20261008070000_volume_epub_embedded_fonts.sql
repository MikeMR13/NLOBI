-- Metadata for the primary embedded EPUB typeface. Raw EPUB CSS is never executed.
alter table public.volumes
  add column if not exists epub_font_url text,
  add column if not exists epub_font_family text;
