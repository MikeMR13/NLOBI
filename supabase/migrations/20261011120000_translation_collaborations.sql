-- Cross-team collaboration is an explicit, accepted credit on a translation.
-- It does not change translations.group_id or grant cross-team editorial permissions.
create table if not exists public.translation_collaborations (
 id uuid primary key default gen_random_uuid(),
 translation_id uuid not null references public.translations(id) on delete cascade,
 inviter_group_id uuid not null references public.translator_groups(id) on delete cascade,
 invited_group_id uuid not null references public.translator_groups(id) on delete cascade,
 invited_by uuid references auth.users(id) on delete set null,
 decided_by uuid references auth.users(id) on delete set null,
 status text not null default 'pending' check (status in ('pending','accepted','declined','revoked')),
 created_at timestamptz not null default now(),
 decided_at timestamptz,
 unique (translation_id,invited_group_id),
 constraint translation_collaborations_different_teams check (inviter_group_id <> invited_group_id)
);
create index if not exists translation_collaborations_invited_status_idx on public.translation_collaborations(invited_group_id,status);
create index if not exists translation_collaborations_translation_status_idx on public.translation_collaborations(translation_id,status);
alter table public.translation_collaborations enable row level security;

-- Accepted credits are public only on visible translations. Pending invitations are
-- visible exclusively to members of either team and platform administrators.
create policy translation_collaborations_public_read on public.translation_collaborations
for select to anon,authenticated using (
 status='accepted' and exists (
  select 1 from public.translations t
  where t.id=translation_collaborations.translation_id
  and t.status in ('active','complete','paused')
 )
);
create policy translation_collaborations_team_read on public.translation_collaborations
for select to authenticated using (
 private.is_site_admin()
 or exists (
  select 1 from public.group_members gm
  where gm.user_id=(select auth.uid())
  and gm.group_id in (translation_collaborations.inviter_group_id,translation_collaborations.invited_group_id)
 )
);
revoke all on public.translation_collaborations from public,anon,authenticated;
grant select on public.translation_collaborations to anon,authenticated;
grant all on public.translation_collaborations to service_role;

create or replace function public.invite_translation_collaboration(p_translation_id uuid,p_invited_group_id uuid)
returns uuid language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_owner uuid; v_id uuid; v_team text; v_title text;
begin
 if v_actor is null then raise exception 'Inicia sesión para invitar equipos.' using errcode='42501'; end if;
 select t.group_id,coalesce(n.title,t.title,'Obra')
 into v_owner,v_title
 from public.translations t left join public.novels n on n.id=t.novel_id
 where t.id=p_translation_id for update of t;
 if v_owner is null then raise exception 'La traducción no existe.'; end if;
 if p_invited_group_id is null or p_invited_group_id=v_owner then
  raise exception 'Selecciona otro equipo traductor.';
 end if;
 if not (private.is_site_admin() or exists (
  select 1 from public.group_members gm
  where gm.group_id=v_owner and gm.user_id=v_actor and gm.role in ('owner','admin')
 )) then raise exception 'Solo los administradores del equipo principal pueden invitar.' using errcode='42501'; end if;
 select name into v_team from public.translator_groups where id=p_invited_group_id;
 if v_team is null then raise exception 'El equipo invitado no existe.'; end if;
 insert into public.translation_collaborations
  (translation_id,inviter_group_id,invited_group_id,invited_by,status)
 values(p_translation_id,v_owner,p_invited_group_id,v_actor,'pending')
 on conflict (translation_id,invited_group_id) do update
 set invited_by=excluded.invited_by,inviter_group_id=excluded.inviter_group_id,
     status='pending',created_at=now(),decided_by=null,decided_at=null
 where public.translation_collaborations.status in ('declined','revoked')
 returning id into v_id;
 if v_id is null then
  raise exception 'Este equipo ya tiene una invitación pendiente o una colaboración aceptada.';
 end if;
 insert into public.notifications(user_id,notification_type,title,body,translation_id,actor_user_id)
 select distinct gm.user_id,'system','Invitación a colaborar',
  'Tu equipo ha sido invitado a colaborar en «'||left(v_title,160)||'». Revisa las invitaciones en Studio.',
  p_translation_id,v_actor
 from public.group_members gm
 where gm.group_id=p_invited_group_id and gm.role in ('owner','admin');
 return v_id;
end;
$$;
revoke all on function public.invite_translation_collaboration(uuid,uuid) from public,anon;
grant execute on function public.invite_translation_collaboration(uuid,uuid) to authenticated,service_role;

create or replace function public.respond_translation_collaboration(p_collaboration_id uuid,p_accept boolean)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_collab public.translation_collaborations%rowtype; v_title text;
begin
 if v_actor is null then raise exception 'Inicia sesión para responder.' using errcode='42501'; end if;
 select * into v_collab from public.translation_collaborations where id=p_collaboration_id for update;
 if not found then raise exception 'Invitación no encontrada.'; end if;
 if not (private.is_site_admin() or exists (
  select 1 from public.group_members gm where gm.group_id=v_collab.invited_group_id
  and gm.user_id=v_actor and gm.role in ('owner','admin')
 )) then raise exception 'Solo la administración del equipo invitado puede responder.' using errcode='42501'; end if;
 if v_collab.status<>'pending' then raise exception 'Esta invitación ya no está pendiente.'; end if;
 update public.translation_collaborations set status=case when p_accept then 'accepted' else 'declined' end,
  decided_by=v_actor,decided_at=now()
 where id=p_collaboration_id;
 select coalesce(n.title,t.title,'Obra') into v_title from public.translations t
 left join public.novels n on n.id=t.novel_id where t.id=v_collab.translation_id;
 insert into public.notifications(user_id,notification_type,title,body,translation_id,actor_user_id)
 select distinct gm.user_id,'system','Respuesta a colaboración',
  'La invitación para «'||left(coalesce(v_title,'Obra'),160)||'» fue '||
  case when p_accept then 'aceptada.' else 'rechazada.' end,v_collab.translation_id,v_actor
 from public.group_members gm
 where gm.group_id=v_collab.inviter_group_id and gm.role in ('owner','admin');
end;
$$;
revoke all on function public.respond_translation_collaboration(uuid,boolean) from public,anon;
grant execute on function public.respond_translation_collaboration(uuid,boolean) to authenticated,service_role;

create or replace function public.revoke_translation_collaboration(p_collaboration_id uuid)
returns void language plpgsql security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_collab public.translation_collaborations%rowtype;
begin
 if v_actor is null then raise exception 'Inicia sesión para continuar.' using errcode='42501'; end if;
 select * into v_collab from public.translation_collaborations where id=p_collaboration_id for update;
 if not found then raise exception 'Colaboración no encontrada.'; end if;
 if not (private.is_site_admin() or exists (
  select 1 from public.group_members gm where gm.user_id=v_actor
  and gm.group_id in (v_collab.inviter_group_id,v_collab.invited_group_id)
  and gm.role in ('owner','admin')
 )) then raise exception 'No tienes permiso para cancelar esta colaboración.' using errcode='42501'; end if;
 if v_collab.status not in ('pending','accepted') then raise exception 'Esta colaboración ya está cerrada.'; end if;
 update public.translation_collaborations set status='revoked',decided_by=v_actor,decided_at=now()
 where id=p_collaboration_id;
end;
$$;
revoke all on function public.revoke_translation_collaboration(uuid) from public,anon;
grant execute on function public.revoke_translation_collaboration(uuid) to authenticated,service_role;
