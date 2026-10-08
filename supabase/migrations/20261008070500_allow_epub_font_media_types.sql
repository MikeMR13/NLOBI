-- Permit the four supported font formats alongside the existing image formats.
update storage.buckets
set allowed_mime_types = array(
  select distinct unnest(coalesce(allowed_mime_types, array[]::text[]) || array['font/woff','font/woff2','font/ttf','font/otf'])
)
where id = 'nlobi-media';
