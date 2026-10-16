-- Fase 4 OX-MR: erratas de lectores, sin métricas personales ni costes recurrentes.
-- Los comentarios ya existentes se consultan con su RLS; no se duplican.
create table if not exists public.translation_errata (
 id uuid primary key default gen_random_uuid(),
 section_id uuid not null references public.sections(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 excerpt text not null default '' check (char_length(excerpt)<=280),
 body text not null check (char_length(btrim(body)) between 12 and 1400),
 status text not null default 'open' check (status in ('open','reviewing','resolved','dismissed')),
 resolution_note text not null default '' check (char_length(resolution_note)<=1200),
 created_at timestamptz not null default now(),
 updated_at timestamptz not null default now(),
 constraint translation_errata_per_reader_section unique(section_id,user_id)
);
create index if not exists translation_errata_section_idx on public.translation_errata(section_id,created_at desc);
create index if not exists translation_errata_status_idx on public.translation_errata(status,updated_at desc);
create index if not exists translation_errata_user_idx on public.translation_errata(user_id,created_at desc);
alter table public.translation_errata enable row level security;
revoke all on public.translation_errata from public,anon,authenticated;
grant select,insert on public.translation_errata to authenticated;
grant update(status,resolution_note) on public.translation_errata to authenticated;

drop policy if exists translation_errata_reader_team_select on public.translation_errata;
create policy translation_errata_reader_team_select on public.translation_errata
for select to authenticated using (
 user_id=(select auth.uid())
 or private.is_site_admin()
 or exists (
  select 1 from public.sections s
  join public.volumes v on v.id=s.volume_id
  join public.translations t on t.id=v.translation_id
  where s.id=translation_errata.section_id
    and private.is_group_member(t.group_id)
 )
);

drop policy if exists translation_errata_reader_insert on public.translation_errata;
create policy translation_errata_reader_insert on public.translation_errata
for insert to authenticated with check (
 user_id=(select auth.uid())
 and status='open' and resolution_note=''
 and exists (
  select 1 from public.sections s
  join public.volumes v on v.id=s.volume_id
  join public.translations t on t.id=v.translation_id
  where s.id=translation_errata.section_id
   and s.status='published' and v.status='published'
   and t.status in ('active','complete','paused')
 )
);

drop policy if exists translation_errata_team_update on public.translation_errata;
create policy translation_errata_team_update on public.translation_errata
for update to authenticated
using (
 private.is_site_admin()
 or exists (
  select 1 from public.sections s
  join public.volumes v on v.id=s.volume_id
  join public.translations t on t.id=v.translation_id
  where s.id=translation_errata.section_id
    and (
      private.team_action_allowed(t.group_id,'review')
      or private.team_action_allowed(t.group_id,'edit')
    )
 )
)
with check (
 private.is_site_admin()
 or exists (
  select 1 from public.sections s
  join public.volumes v on v.id=s.volume_id
  join public.translations t on t.id=v.translation_id
  where s.id=translation_errata.section_id
    and (
      private.team_action_allowed(t.group_id,'review')
      or private.team_action_allowed(t.group_id,'edit')
    )
 )
);
-- Los lectores nunca pueden modificar el reporte; los equipos solo cambian
-- estado y nota, por grants a nivel de columna. No hay DELETE de usuario.
comment on table public.translation_errata is
 'Reporte de errata por usuario y capítulo público; visible a autor y equipo traductor. No sustituye comentarios ni métricas de lectura.';
