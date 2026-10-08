-- Store all validated EPUB font-face entries (family, weight, style and storage URL).
alter table public.volumes add column if not exists epub_fonts jsonb not null default '[]'::jsonb;
