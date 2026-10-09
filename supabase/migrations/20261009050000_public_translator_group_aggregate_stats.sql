-- Public aggregate counters without exposing follower/member identities.
create or replace function public.get_public_translator_group_stats(p_group_id uuid)
returns table(followers bigint,members bigint)
language sql stable security definer set search_path='' as $$
 select (select count(*) from public.follows f where f.target_type='translator_group' and f.target_id=p_group_id),
        (select count(*) from public.group_members m where m.group_id=p_group_id)
 where exists(select 1 from public.translator_groups g where g.id=p_group_id)
$$;
revoke all on function public.get_public_translator_group_stats(uuid) from public;
grant execute on function public.get_public_translator_group_stats(uuid) to anon, authenticated;
