-- Reversión Fase 2: restaurar exactamente las 18 RPC previas en public
-- y retirar implementaciones internas. Ejecutar solo por fallo de validación.
begin;

-- admin_review_purchase_link
CREATE OR REPLACE FUNCTION public.admin_review_purchase_link(link_id uuid, verified boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  if not private.is_site_admin() then raise exception 'Admin required'; end if;

  update public.purchase_links
  set is_verified = verified
  where id = link_id;

  if not found then raise exception 'Purchase link not found'; end if;

  insert into public.moderation_audit(actor_user_id,action_type,target_type,target_id,details)
  values((select auth.uid()),
    case when verified then 'link_verified' else 'link_unverified' end,
    'purchase_link',link_id,jsonb_build_object('verified',verified));
end;
$function$;
-- admin_review_team_application
CREATE OR REPLACE FUNCTION public.admin_review_team_application(application_id uuid, decision text, note text DEFAULT NULL::text)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  app public.team_applications%rowtype;
  new_group_id uuid;
begin
  if not private.is_site_admin() then raise exception 'Admin required'; end if;

  select * into app
  from public.team_applications
  where id = application_id
  for update;

  if not found then raise exception 'Application not found'; end if;
  if app.status <> 'pending' then raise exception 'Application already reviewed'; end if;

  if decision = 'approved' then
    insert into public.translator_groups(name,slug,description,created_by)
    values(app.requested_name,app.requested_slug,app.description,app.applicant_id)
    returning id into new_group_id;

    insert into public.group_members(group_id,user_id,role)
    values(new_group_id,app.applicant_id,'owner');

    update public.team_applications
    set status='approved', reviewed_by=(select auth.uid()), reviewed_at=now(),
        admin_note=note, updated_at=now()
    where id=application_id;

    insert into public.moderation_audit(actor_user_id,action_type,target_type,target_id,details)
    values((select auth.uid()),'application_approved','team_application',application_id,
      jsonb_build_object('group_id',new_group_id,'note',note));

    if private.notification_enabled(app.applicant_id,'team_updates') then
      insert into public.notifications
        (user_id,notification_type,title,body,event_key)
      values(
        app.applicant_id,'team_application','Tu equipo fue aprobado',
        app.requested_name,'team-application-approved:'||application_id::text
      )
      on conflict do nothing;
    end if;

    return new_group_id;

  elsif decision = 'rejected' then
    update public.team_applications
    set status='rejected', reviewed_by=(select auth.uid()), reviewed_at=now(),
        admin_note=note, updated_at=now()
    where id=application_id;

    insert into public.moderation_audit(actor_user_id,action_type,target_type,target_id,details)
    values((select auth.uid()),'application_rejected','team_application',application_id,
      jsonb_build_object('note',note));

    if private.notification_enabled(app.applicant_id,'team_updates') then
      insert into public.notifications
        (user_id,notification_type,title,body,event_key)
      values(
        app.applicant_id,'team_application','Tu solicitud de equipo fue rechazada',
        coalesce(note,app.requested_name),'team-application-rejected:'||application_id::text
      )
      on conflict do nothing;
    end if;

    return null;
  else
    raise exception 'Invalid decision';
  end if;
end;
$function$;
-- create_translation_project
CREATE OR REPLACE FUNCTION public.create_translation_project(p_group_id uuid, p_title text, p_title_original text DEFAULT NULL::text, p_author_name text DEFAULT NULL::text, p_synopsis text DEFAULT NULL::text, p_cover_url text DEFAULT NULL::text, p_genres text[] DEFAULT '{}'::text[], p_tags text[] DEFAULT '{}'::text[], p_language_code text DEFAULT 'es'::text)
 RETURNS TABLE(translation_id uuid, novel_id uuid)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
 v_novel_id uuid;
 v_translation_id uuid;
 v_slug text;
begin
 if auth.uid() is null then raise exception 'Authentication required'; end if;
 if not (private.is_site_admin() or private.is_group_editor(p_group_id)) then
   raise exception 'Editorial permission required';
 end if;
 if nullif(btrim(p_title),'') is null then raise exception 'Title required'; end if;
 if char_length(p_title)>220 then raise exception 'Title too long'; end if;
 if p_language_code is null or char_length(btrim(p_language_code))<2 or char_length(btrim(p_language_code))>12 then
   raise exception 'Invalid language code';
 end if;

 v_slug:=regexp_replace(
   lower(translate(p_title,'ÁÉÍÓÚÜÑáéíóúüñ','AEIOUUNaeiouun')),
   '[^a-z0-9]+','-','g');
 v_slug:=trim(both '-' from v_slug);
 if v_slug='' then v_slug:='obra'; end if;
 v_slug:=left(v_slug,80)||'-'||substr(replace(gen_random_uuid()::text,'-',''),1,8);

 insert into public.novels(slug,title,title_original,author_name,synopsis,cover_url,genres,tags,status,sequel_status)
 values (
   v_slug,btrim(p_title),nullif(btrim(p_title_original),''),
   nullif(btrim(p_author_name),''),nullif(btrim(p_synopsis),''),
   nullif(btrim(p_cover_url),''),coalesce(p_genres,'{}'),coalesce(p_tags,'{}'),null,null
 )
 returning id into v_novel_id;

 insert into public.translations(novel_id,group_id,language_code,title,status)
 values(v_novel_id,p_group_id,lower(btrim(p_language_code)),btrim(p_title),'active')
 returning id into v_translation_id;

 return query select v_translation_id,v_novel_id;
end;
$function$;
-- find_team_member_by_email
CREATE OR REPLACE FUNCTION public.find_team_member_by_email(p_group_id uuid, p_email text)
 RETURNS TABLE(id uuid, username text, display_name text)
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
 if auth.uid() is null or not (private.is_group_manager(p_group_id) or private.is_site_admin()) then
  raise exception 'No tienes permiso para buscar miembros' using errcode='42501';
 end if;
 if p_email is null or length(trim(p_email))>254 or trim(p_email)!~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$' then
  raise exception 'Correo electrónico inválido' using errcode='22023';
 end if;
 return query
 select p.id,p.username,p.display_name
 from auth.users u join public.profiles p on p.id=u.id
 where lower(u.email)=lower(trim(p_email)) and u.deleted_at is null
 limit 1;
end
$function$;
-- get_admin_review_reports
CREATE OR REPLACE FUNCTION public.get_admin_review_reports()
 RETURNS TABLE(id uuid, review_id uuid, reason text, status text, created_at timestamp with time zone, body text, translation_id uuid)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select rp.id,rp.review_id,rp.reason,rp.status,rp.created_at,r.body,r.translation_id
 from public.translation_review_reports rp
 left join public.translation_reviews r on r.id=rp.review_id
 where exists(select 1 from public.site_admins a where a.user_id=(select auth.uid()))
 order by rp.created_at desc limit 200
$function$;
-- get_discoverable_readers
CREATE OR REPLACE FUNCTION public.get_discoverable_readers()
 RETURNS TABLE(reader_id uuid, username text, display_name text, avatar_url text, bio text, public_library boolean, public_activity boolean, favorite_genres text[], followers bigint, public_collections bigint, public_reviews bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select p.id,p.username,p.display_name,p.avatar_url,left(coalesce(p.bio,''),300),
 p.public_library,p.public_activity,
 coalesce((
  select array_agg(distinct g.genre order by g.genre) from (
   select unnest(n.genres) as genre
   from public.reader_collections c
   join public.reader_collection_items i on i.collection_id=c.id
   join public.translations t on t.id=i.translation_id and t.status in ('active','complete','paused')
   join public.novels n on n.id=t.novel_id
   where c.user_id=p.id and c.is_public
   union all
   select unnest(n.genres) as genre
   from public.library_entries le
   join public.translations t on t.id=le.translation_id and t.status in ('active','complete','paused')
   join public.novels n on n.id=t.novel_id
   where le.user_id=p.id and p.public_library
  ) g where nullif(trim(g.genre),'') is not null
 ), '{}'::text[]),
 (select count(*) from public.reader_follows f where f.followed_id=p.id),
 (select count(*) from public.reader_collections c where c.user_id=p.id and c.is_public),
 (select count(*) from public.translation_reviews r
   join public.translations t on t.id=r.translation_id
   where r.user_id=p.id and t.status in ('active','complete','paused'))
from public.profiles p
where p.discoverable_reader=true
order by p.updated_at desc,p.id
limit 200
$function$;
-- get_followed_reader_activity
CREATE OR REPLACE FUNCTION public.get_followed_reader_activity()
 RETURNS TABLE(event_type text, reader_id uuid, reader_name text, translation_id uuid, translation_title text, progress_percent numeric, event_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select e.event_type,e.reader_id,e.reader_name,e.translation_id,e.translation_title,e.progress_percent,e.event_at
 from (
  select 'reading'::text as event_type,p.id as reader_id,
    coalesce(nullif(p.display_name,''),nullif(p.username,''),'Lector') as reader_name,
    t.id as translation_id,coalesce(n.title,t.title,'Novela') as translation_title,
    greatest(0,least(100,rp.progress_percent)) as progress_percent,rp.updated_at as event_at
  from public.reader_follows f
  join public.profiles p on p.id=f.followed_id and p.public_activity=true
  join public.reading_progress rp on rp.user_id=p.id
  join public.translations t on t.id=rp.translation_id and t.status in ('active','complete','paused')
  join public.novels n on n.id=t.novel_id
  where f.follower_id=(select auth.uid())
  union all
  select 'review'::text,p.id,
    coalesce(nullif(p.display_name,''),nullif(p.username,''),'Lector'),
    t.id,coalesce(n.title,t.title,'Novela'),null::numeric,r.updated_at
  from public.reader_follows f
  join public.profiles p on p.id=f.followed_id
  join public.translation_reviews r on r.user_id=p.id
  join public.translations t on t.id=r.translation_id and t.status in ('active','complete','paused')
  join public.novels n on n.id=t.novel_id
  where f.follower_id=(select auth.uid())
 ) e
 where (select auth.uid()) is not null
 order by e.event_at desc
 limit 30
$function$;
-- get_public_collection_save_counts
CREATE OR REPLACE FUNCTION public.get_public_collection_save_counts()
 RETURNS TABLE(collection_id uuid, saves bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select c.id,count(s.user_id) from public.reader_collections c
 left join public.reader_collection_saves s on s.collection_id=c.id
 where c.is_public group by c.id
$function$;
-- get_public_reader_reviews
CREATE OR REPLACE FUNCTION public.get_public_reader_reviews(p_user_id uuid)
 RETURNS TABLE(review_id uuid, translation_id uuid, translation_title text, body text, contains_spoilers boolean, updated_at timestamp with time zone)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select r.id,r.translation_id,coalesce(n.title,t.title,'Novela'),r.body,r.contains_spoilers,r.updated_at
 from public.translation_reviews r
 join public.translations t on t.id=r.translation_id
 left join public.novels n on n.id=t.novel_id
 where r.user_id=p_user_id and t.status in ('active','complete','paused')
 order by r.updated_at desc limit 20
$function$;
-- get_public_translator_group_stats
CREATE OR REPLACE FUNCTION public.get_public_translator_group_stats(p_group_id uuid)
 RETURNS TABLE(followers bigint, members bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select (select count(*) from public.follows f where f.target_type='translator_group' and f.target_id=p_group_id),
        (select count(*) from public.group_members m where m.group_id=p_group_id)
 where exists(select 1 from public.translator_groups g where g.id=p_group_id)
$function$;
-- get_reader_social_counts
CREATE OR REPLACE FUNCTION public.get_reader_social_counts(p_reader_id uuid)
 RETURNS TABLE(followers bigint, following bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select
 (select count(*) from public.reader_follows f where f.followed_id=p_reader_id),
 (select count(*) from public.reader_follows f where f.follower_id=p_reader_id)
where exists(select 1 from public.profiles p where p.id=p_reader_id)
$function$;
-- get_translation_rating_distribution
CREATE OR REPLACE FUNCTION public.get_translation_rating_distribution(p_translation_id uuid)
 RETURNS TABLE(stars smallint, votes bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select s.n::smallint,count(r.stars) from generate_series(1,5) s(n)
 left join public.translation_ratings r on r.stars=s.n and r.translation_id=p_translation_id
 left join public.translations t on t.id=p_translation_id
 where t.status in ('active','complete','paused')
 group by s.n order by s.n desc $function$;
-- get_translation_rating_summaries
CREATE OR REPLACE FUNCTION public.get_translation_rating_summaries()
 RETURNS TABLE(translation_id uuid, average_rating numeric, ratings_count bigint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
 select r.translation_id, round(avg(r.stars)::numeric,2),count(*)
 from public.translation_ratings r
 join public.translations t on t.id=r.translation_id
 where t.status in ('active','complete','paused')
 group by r.translation_id
$function$;
-- get_translation_reviews
CREATE OR REPLACE FUNCTION public.get_translation_reviews(p_translation_id uuid)
 RETURNS TABLE(id uuid, user_id uuid, display_name text, username text, avatar_url text, body text, contains_spoilers boolean, created_at timestamp with time zone, updated_at timestamp with time zone, helpful_count bigint, my_helpful boolean, reviewer_stars smallint)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
select r.id,r.user_id,p.display_name,p.username,p.avatar_url,r.body,r.contains_spoilers,r.created_at,r.updated_at,
(select count(*) from public.translation_review_votes v where v.review_id=r.id),
exists(select 1 from public.translation_review_votes v where v.review_id=r.id and v.user_id=(select auth.uid())),rating.stars
from public.translation_reviews r join public.translations t on t.id=r.translation_id
left join public.profiles p on p.id=r.user_id
left join public.translation_ratings rating on rating.translation_id=r.translation_id and rating.user_id=r.user_id
where r.translation_id=p_translation_id and t.status in ('active','complete','paused')
order by r.updated_at desc,r.created_at desc
$function$;
-- invite_translation_collaboration
CREATE OR REPLACE FUNCTION public.invite_translation_collaboration(p_translation_id uuid, p_invited_group_id uuid)
 RETURNS uuid
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
-- moderate_translation_review_report
CREATE OR REPLACE FUNCTION public.moderate_translation_review_report(p_report_id uuid, p_action text)
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare v_review uuid;
begin
 if not exists(select 1 from public.site_admins where user_id=(select auth.uid())) then raise exception 'Acceso denegado';end if;
 if p_action not in ('reviewed','dismissed','delete') then raise exception 'Acción inválida';end if;
 select review_id into v_review from public.translation_review_reports where id=p_report_id and status='pending' for update;
 if v_review is null then return false;end if;
 if p_action='delete' then
   delete from public.translation_reviews where id=v_review;
 else
   update public.translation_review_reports set status=p_action where id=p_report_id;
 end if;
 return true;
end $function$;
-- respond_translation_collaboration
CREATE OR REPLACE FUNCTION public.respond_translation_collaboration(p_collaboration_id uuid, p_accept boolean)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
-- revoke_translation_collaboration
CREATE OR REPLACE FUNCTION public.revoke_translation_collaboration(p_collaboration_id uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
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
$function$;
drop function if exists rpc_internal.admin_review_purchase_link(link_id uuid, verified boolean);
drop function if exists rpc_internal.admin_review_team_application(application_id uuid, decision text, note text);
drop function if exists rpc_internal.create_translation_project(p_group_id uuid, p_title text, p_title_original text, p_author_name text, p_synopsis text, p_cover_url text, p_genres text[], p_tags text[], p_language_code text);
drop function if exists rpc_internal.find_team_member_by_email(p_group_id uuid, p_email text);
drop function if exists rpc_internal.get_admin_review_reports();
drop function if exists rpc_internal.get_discoverable_readers();
drop function if exists rpc_internal.get_followed_reader_activity();
drop function if exists rpc_internal.get_public_collection_save_counts();
drop function if exists rpc_internal.get_public_reader_reviews(p_user_id uuid);
drop function if exists rpc_internal.get_public_translator_group_stats(p_group_id uuid);
drop function if exists rpc_internal.get_reader_social_counts(p_reader_id uuid);
drop function if exists rpc_internal.get_translation_rating_distribution(p_translation_id uuid);
drop function if exists rpc_internal.get_translation_rating_summaries();
drop function if exists rpc_internal.get_translation_reviews(p_translation_id uuid);
drop function if exists rpc_internal.invite_translation_collaboration(p_translation_id uuid, p_invited_group_id uuid);
drop function if exists rpc_internal.moderate_translation_review_report(p_report_id uuid, p_action text);
drop function if exists rpc_internal.respond_translation_collaboration(p_collaboration_id uuid, p_accept boolean);
drop function if exists rpc_internal.revoke_translation_collaboration(p_collaboration_id uuid);
drop schema if exists rpc_internal restrict;
commit;
