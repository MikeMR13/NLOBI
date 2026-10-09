
create or replace function public.get_public_reader_reviews(p_user_id uuid)
returns table (review_id uuid,translation_id uuid,translation_title text,body text,contains_spoilers boolean,updated_at timestamptz)
language sql stable security definer set search_path='' as $$
 select r.id,r.translation_id,coalesce(n.title,t.title,'Novela'),r.body,r.contains_spoilers,r.updated_at
 from public.translation_reviews r
 join public.translations t on t.id=r.translation_id
 left join public.novels n on n.id=t.novel_id
 where r.user_id=p_user_id and t.status in ('active','complete','paused')
 order by r.updated_at desc limit 20
$$;
revoke all on function public.get_public_reader_reviews(uuid) from public;
grant execute on function public.get_public_reader_reviews(uuid) to anon,authenticated;

create or replace function public.get_admin_review_reports()
returns table (id uuid,review_id uuid,reason text,status text,created_at timestamptz,body text,translation_id uuid)
language sql stable security definer set search_path='' as $$
 select rp.id,rp.review_id,rp.reason,rp.status,rp.created_at,r.body,r.translation_id
 from public.translation_review_reports rp
 left join public.translation_reviews r on r.id=rp.review_id
 where exists(select 1 from public.site_admins a where a.user_id=(select auth.uid()))
 order by rp.created_at desc limit 200
$$;
revoke all on function public.get_admin_review_reports() from public;
grant execute on function public.get_admin_review_reports() to authenticated;
