-- Sinopsis independiente y opcional para cada volumen.
-- No modifica la sinopsis global de novels/translations ni sus permisos RLS.
alter table public.volumes add column if not exists synopsis text;
comment on column public.volumes.synopsis is 'Sinopsis opcional del volumen, independiente de la sinopsis de la obra.';
