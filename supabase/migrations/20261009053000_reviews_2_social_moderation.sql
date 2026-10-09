create table if not exists public.translation_review_votes (
 review_id uuid not null references public.translation_reviews(id) on delete cascade,
 user_id uuid not null references auth.users(id) on delete cascade,
 created_at timestamptz not null default now(),
 primary key (review_id,user_id)
);
create index if not exists translation_review_votes_user_idx on public.translation_review_votes(user_id);
alter table public.translation_review_votes enable row level security;
revoke all on public.translation_review_votes from anon;
grant select,insert,delete on public.translation_review_votes to authenticated;
drop policy if exists review_votes_select_own on public.translation_review_votes;
create policy review_votes_select_own on public.translation_review_votes for select to authenticated using (user_id=(select auth.uid()));
drop policy if exists review_votes_insert_own on public.translation_review_votes;
create policy review_votes_insert_own on public.translation_review_votes for insert to authenticated with check (user_id=(select auth.uid()) and exists (select 1 from public.translation_reviews r join public.translations t on t.id=r.translation_id where r.id=review_id and r.user_id<> (select auth.uid()) and t.status in ('active','complete','paused')));
drop policy if exists review_votes_delete_own on public.translation_review_votes;
create policy review_votes_delete_own on public.translation_review_votes for delete to authenticated using (user_id=(select auth.uid()));

create table if not exists public.translation_review_reports (
 id uuid primary key default gen_random_uuid(),
 review_id uuid not null references public.translation_reviews(id) on delete cascade,
 reporter_id uuid not null references auth.users(id) on delete cascade,
 reason text not null check(reason in ('spoiler','spam','abuse','other')),
 status text not null default 'pending' check(status in ('pending','reviewed','dismissed')),
 created_at timestamptz not null default now(),
 unique(review_id,reporter_id)
);
create index if not exists translation_review_reports_status_idx on public.translation_review_reports(status,created_at desc);
alter table public.translation_review_reports enable row level security;
revoke all on public.translation_review_reports from anon;
grant select,insert on public.translation_review_reports to authenticated;
drop policy if exists review_reports_select_own_admin on public.translation_review_reports;
create policy review_reports_select_own_admin on public.translation_review_reports for select to authenticated using (reporter_id=(select auth.uid()) or exists(select 1 from public.site_admins sa where sa.user_id=(select auth.uid())));
drop policy if exists review_reports_insert_own on public.translation_review_reports;
create policy review_reports_insert_own on public.translation_review_reports for insert to authenticated with check(reporter_id=(select auth.uid()) and exists(select 1 from public.translation_reviews r where r.id=review_id and r.user_id<>(select auth.uid())));

drop function if exists public.get_translation_reviews(uuid);
create function public.get_translation_reviews(p_translation_id uuid)
returns table (id uuid,user_id uuid,display_name text,username text,avatar_url text,body text,contains_spoilers boolean,created_at timestamptz,updated_at timestamptz,helpful_count bigint,my_helpful boolean)
language sql stable security definer set search_path='' as $$
select r.id,r.user_id,p.display_name,p.username,p.avatar_url,r.body,r.contains_spoilers,r.created_at,r.updated_at,
(select count(*) from public.translation_review_votes v where v.review_id=r.id),
exists(select 1 from public.translation_review_votes v where v.review_id=r.id and v.user_id=(select auth.uid()))
from public.translation_reviews r join public.translations t on t.id=r.translation_id
left join public.profiles p on p.id=r.user_id
where r.translation_id=p_translation_id and t.status in ('active','complete','paused')
order by r.updated_at desc,r.created_at desc $$;
revoke all on function public.get_translation_reviews(uuid) from public;
grant execute on function public.get_translation_reviews(uuid) to anon,authenticated;

create or replace function public.get_translation_rating_distribution(p_translation_id uuid)
returns table(stars smallint,votes bigint)
language sql stable security definer set search_path='' as $$
 select s.n::smallint,count(r.stars) from generate_series(1,5) s(n)
 left join public.translation_ratings r on r.stars=s.n and r.translation_id=p_translation_id
 left join public.translations t on t.id=p_translation_id
 where t.status in ('active','complete','paused')
 group by s.n order by s.n desc $$;
revoke all on function public.get_translation_rating_distribution(uuid) from public;
grant execute on function public.get_translation_rating_distribution(uuid) to anon,authenticated;

create or replace function public.moderate_translation_review_report(p_report_id uuid,p_action text)
returns boolean language plpgsql security definer set search_path='' as $$
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
end $$;
revoke all on function public.moderate_translation_review_report(uuid,text) from public;
grant execute on function public.moderate_translation_review_report(uuid,text) to authenticated;
