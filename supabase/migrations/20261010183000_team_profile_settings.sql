-- El perfil usa el RLS de translator_groups: solo los administradores autorizados pueden actualizarlo.
alter table public.translator_groups
  add column if not exists profile_settings jsonb not null default '{}'::jsonb;
alter table public.translator_groups
  add constraint translator_groups_profile_settings_object
  check (jsonb_typeof(profile_settings) = 'object' and pg_column_size(profile_settings) <= 32768);
comment on column public.translator_groups.profile_settings is 'Configuración pública y editorial del equipo, controlada por su RLS existente.';
