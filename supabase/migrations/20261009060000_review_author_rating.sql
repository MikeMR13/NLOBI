drop function if exists public.get_translation_reviews(uuid);
create function public.get_translation_reviews(p_translation_id uuid)
returns table (id uuid,user_id uuid,display_name text,username text,avatar_url text,body text,contains_spoilers boolean,created_at timestamptz,updated_at timestamptz,helpful_count bigint,my_helpful boolean,reviewer_stars smallint)
language sql stable security definer set search_path='' as $$
select r.id,r.user_id,p.display_name,p.username,p.avatar_url,r.body,r.contains_spoilers,r.created_at,r.updated_at,
(select count(*) from public.translation_review_votes v where v.review_id=r.id),
exists(select 1 from public.translation_review_votes v where v.review_id=r.id and v.user_id=(select auth.uid())),rating.stars
from public.translation_reviews r join public.translations t on t.id=r.translation_id
left join public.profiles p on p.id=r.user_id
left join public.translation_ratings rating on rating.translation_id=r.translation_id and rating.user_id=r.user_id
where r.translation_id=p_translation_id and t.status in ('active','complete','paused')
order by r.updated_at desc,r.created_at desc
$$;
revoke all on function public.get_translation_reviews(uuid) from public;
grant execute on function public.get_translation_reviews(uuid) to anon,authenticated;