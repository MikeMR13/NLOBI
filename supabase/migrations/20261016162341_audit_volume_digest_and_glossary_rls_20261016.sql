-- Auditoría OX-MR / 2026-10-16. Sin tablas ni servicios adicionales.
-- Una publicación inicial por volumen, y como máximo un aviso de actualización
-- por destinatario y volumen en cada hora UTC. Los capítulos nunca crean avisos propios.
create or replace function private.notify_volume_activity(p_volume_id uuid, p_kind text)
returns void
language plpgsql
security definer
set search_path = ''
as $function$
declare
  v_translation_id uuid;
  v_novel_id uuid;
  v_group_id uuid;
  v_work_title text;
  v_volume_title text;
  v_volume_number numeric;
  v_event_key text;
begin
  if p_kind not in ('published', 'updated') then
    raise exception 'Invalid volume activity';
  end if;

  select t.id, t.novel_id, t.group_id, n.title, v.title, v.volume_number
    into v_translation_id, v_novel_id, v_group_id, v_work_title,
         v_volume_title, v_volume_number
  from public.volumes v
  join public.translations t on t.id = v.translation_id
  join public.novels n on n.id = t.novel_id
  where v.id = p_volume_id
    and v.status = 'published'
    and t.status in ('active', 'complete', 'paused');

  if v_translation_id is null then return; end if;

  -- La unicidad de (user_id,event_key) ya está impuesta por idx_notifications_user_event.
  -- Separar published de updated conserva el anuncio inicial y elimina duplicados
  -- de procesos masivos por transacción o por capítulo en la misma hora.
  v_event_key := case
    when p_kind = 'published' then 'volume-published:' || p_volume_id::text
    else 'volume-updated:' || p_volume_id::text || ':' ||
         pg_catalog.to_char(pg_catalog.transaction_timestamp() at time zone 'UTC', 'YYYYMMDDHH24')
    end;

  insert into public.notifications
    (user_id, notification_type, title, body, translation_id,
     volume_id, section_id, event_key)
  select distinct f.user_id,
    'new_publication',
    (case when p_kind = 'published' then 'Nuevo volumen · '
          else 'Volumen actualizado · ' end) || coalesce(v_work_title,'Novela'),
    'Vol. ' || v_volume_number::text ||
      coalesce(' · ' || nullif(v_volume_title,''),''),
    v_translation_id, p_volume_id, null::uuid, v_event_key
  from public.follows f
  where (
    (f.target_type = 'novel' and f.target_id = v_novel_id)
    or (f.target_type = 'translation' and f.target_id = v_translation_id)
    or (f.target_type = 'translator_group' and f.target_id = v_group_id)
  )
  and private.notification_enabled(f.user_id,'new_publications')
  -- Si el volumen acaba de estrenarse, las inserciones de capítulos durante
  -- esa primera hora forman parte del mismo anuncio y no duplican la campana.
  and not (
    p_kind = 'updated' and exists (
      select 1 from public.notifications previous
      where previous.user_id = f.user_id
        and previous.volume_id = p_volume_id
        and previous.event_key = 'volume-published:' || p_volume_id::text
        and previous.created_at >= pg_catalog.transaction_timestamp() - interval '1 hour'
    )
  )
  on conflict do nothing;
end;
$function$;

-- Corregir también el filtro SELECT del glosario: antes, el EXISTS público
-- no relacionaba la obra publicada con translation_glossary_terms.translation_id.
-- Una obra cualquiera publicada hacía visibles términos de otros borradores.
drop policy if exists translation_glossary_public_select on public.translation_glossary_terms;
drop policy if exists translation_glossary_team_select on public.translation_glossary_terms;
drop policy if exists translation_glossary_anon_read on public.translation_glossary_terms;
drop policy if exists translation_glossary_authenticated_read on public.translation_glossary_terms;

create policy translation_glossary_anon_read
on public.translation_glossary_terms for select to anon
using (
  exists (
    select 1 from public.translations t
    join public.volumes v on v.translation_id=t.id
    join public.sections s on s.volume_id=v.id
    where t.id=translation_glossary_terms.translation_id
      and v.status='published' and s.status='published'
  )
);

create policy translation_glossary_authenticated_read
on public.translation_glossary_terms for select to authenticated
using (
  exists (
    select 1 from public.translations t
    join public.volumes v on v.translation_id=t.id
    join public.sections s on s.volume_id=v.id
    where t.id=translation_glossary_terms.translation_id
      and v.status='published' and s.status='published'
  )
  or exists (
    select 1 from public.translations t
    where t.id=translation_glossary_terms.translation_id
      and private.team_action_allowed(t.group_id,'edit')
  )
);
