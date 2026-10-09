-- Personal community feed: a signed-in reader can see only public reviews
-- and reading updates explicitly shared by profiles they follow.
create or replace function public.get_followed_reader_activity()
returns table(
 event_type text,
 reader_id uuid,
 reader_name text,
 translation_id uuid,
 translation_title text,
 progress_percent numeric,
 event_at timestamptz
)
language sql stable security definer set search_path = '' as $$
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
$$;
revoke all on function public.get_followed_reader_activity() from public;
grant execute on function public.get_followed_reader_activity() to authenticated;
