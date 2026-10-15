-- OX-MR > NLOBI · fase 1. Glosario contextual por traducción.
-- Depende de translations, volumes, sections y private.team_action_allowed.
-- No conceder acceso a service_role en el frontend.
create table if not exists public.translation_glossary_terms (
  id uuid primary key default gen_random_uuid(),
  translation_id uuid not null references public.translations(id) on delete cascade,
  term text not null check (char_length(btrim(term)) between 2 and 80),
  category text not null default 'Término' check (char_length(btrim(category)) between 2 and 40),
  definition text not null check (char_length(btrim(definition)) between 1 and 800),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists translation_glossary_unique_term
  on public.translation_glossary_terms(translation_id, lower(btrim(term)));
create index if not exists translation_glossary_by_translation
  on public.translation_glossary_terms(translation_id, term);
alter table public.translation_glossary_terms enable row level security;
revoke all on public.translation_glossary_terms from public, anon, authenticated;
grant select on public.translation_glossary_terms to anon, authenticated;
grant insert(translation_id, term, category, definition)
  on public.translation_glossary_terms to authenticated;
grant update(term, category, definition, updated_at)
  on public.translation_glossary_terms to authenticated;
grant delete on public.translation_glossary_terms to authenticated;

-- El público solo ve glosarios de traducciones con capítulos publicados.
-- Miembros con permisos de edición también pueden consultar obras en borrador.
create policy translation_glossary_select
on public.translation_glossary_terms for select to anon, authenticated
using (
  exists (
    select 1 from public.translations t
    join public.volumes v on v.translation_id=t.id
    join public.sections s on s.volume_id=v.id
    where t.id=translation_id and v.status='published' and s.status='published'
  )
  or exists (
    select 1 from public.translations t
    where t.id=translation_id and private.team_action_allowed(t.group_id,'edit')
  )
);
create policy translation_glossary_insert
on public.translation_glossary_terms for insert to authenticated
with check (
  exists (select 1 from public.translations t
    where t.id=translation_id and private.team_action_allowed(t.group_id,'edit'))
);
create policy translation_glossary_update
on public.translation_glossary_terms for update to authenticated
using (
  exists (select 1 from public.translations t
    where t.id=translation_id and private.team_action_allowed(t.group_id,'edit'))
)
with check (
  exists (select 1 from public.translations t
    where t.id=translation_id and private.team_action_allowed(t.group_id,'edit'))
);
create policy translation_glossary_delete
on public.translation_glossary_terms for delete to authenticated
using (
  exists (select 1 from public.translations t
    where t.id=translation_id and private.team_action_allowed(t.group_id,'edit'))
);

-- Restricciones del registro: impide cambiar el ámbito entre equipos.
create or replace function private.guard_translation_glossary()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE' and new.translation_id is distinct from old.translation_id then
    raise exception 'No se puede cambiar el glosario de obra' using errcode='42501';
  end if;
  new.term=btrim(new.term);
  new.category=btrim(new.category);
  new.definition=btrim(new.definition);
  if new.term='' or new.definition='' then
    raise exception 'Término y definición son obligatorios' using errcode='22023';
  end if;
  new.updated_at=now();
  return new;
end; $$;
drop trigger if exists translation_glossary_guard on public.translation_glossary_terms;
create trigger translation_glossary_guard before insert or update
on public.translation_glossary_terms for each row
execute function private.guard_translation_glossary();
