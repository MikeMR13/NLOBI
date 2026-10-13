-- Auditoría integral de rendimiento: índices de rutas de consulta y RLS estable.
-- Mantener la semántica de permisos, la edición y los triggers editoriales.

-- Catálogo: filtros de publicación + orden de novedades.
create index if not exists translations_status_updated_perf_idx
  on public.translations (status, updated_at desc);
create index if not exists volumes_status_published_perf_idx
  on public.volumes (status, published_at desc)
  where published_at is not null;
create index if not exists sections_status_published_perf_idx
  on public.sections (status, published_at desc)
  where published_at is not null;

-- Referencias externas para cascadas y búsquedas, faltantes según advisor.
create index if not exists editorial_publication_events_volume_perf_idx
  on public.editorial_publication_events (volume_id);
create index if not exists group_public_members_user_perf_idx
  on public.group_public_members (user_id);
create index if not exists reader_annotations_section_perf_idx
  on public.reader_annotations (section_id);
create index if not exists reader_annotations_translation_perf_idx
  on public.reader_annotations (translation_id);
create index if not exists translation_collaborations_decided_by_perf_idx
  on public.translation_collaborations (decided_by);
create index if not exists translation_collaborations_invited_by_perf_idx
  on public.translation_collaborations (invited_by);
create index if not exists translation_collaborations_inviter_group_perf_idx
  on public.translation_collaborations (inviter_group_id);
create index if not exists translations_auto_status_source_volume_perf_idx
  on public.translations (auto_status_source_volume_id);

-- Se conserva el índice one_pending_volume_schedule, de igual definición.
drop index if exists public.volume_schedule_one_pending_per_volume;

-- Optimizar las llamadas constantes de autenticación: se evalúan por sentencia.
alter policy "Readers view own UI preferences"
  on public.reader_ui_preferences to authenticated
  using ((select auth.uid()) = user_id);
alter policy "Readers insert own UI preferences"
  on public.reader_ui_preferences to authenticated
  with check ((select auth.uid()) = user_id);
alter policy "Readers update own UI preferences"
  on public.reader_ui_preferences to authenticated
  using ((select auth.uid()) = user_id)
  with check ((select auth.uid()) = user_id);
