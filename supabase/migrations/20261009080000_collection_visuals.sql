alter table public.reader_collections add column if not exists accent_color text not null default '#ad794e' check(accent_color ~ '^#[0-9A-Fa-f]{6}$');
alter table public.reader_collections add column if not exists cover_translation_id uuid references public.translations(id) on delete set null;
create or replace function public.position_reader_collection_item(p_collection uuid,p_translation uuid,p_position integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_items uuid[];v_len integer;
begin
 if not exists(select 1 from public.reader_collections where id=p_collection and user_id=(select auth.uid())) then return false; end if;
 select array_agg(translation_id order by sort_order,created_at,translation_id) into v_items from public.reader_collection_items where collection_id=p_collection;
 v_len:=coalesce(array_length(v_items,1),0);
 if v_len<2 or p_position<1 or p_position>v_len or not (p_translation=any(v_items)) then return false;end if;
 select array_agg(x order by CASE WHEN x=p_translation THEN p_position ELSE CASE WHEN ord>=p_position THEN ord+1 ELSE ord END END) into v_items from unnest(v_items) with ordinality q(x,ord) where x<>p_translation or x=p_translation;
 -- reorder using array slices to avoid position collisions
 select array_agg(x order by rank) into v_items from (
 select x,case when x=p_translation then p_position::numeric else row_number() over (order by ord)::numeric + case when row_number() over (order by ord)>=p_position then 1 else 0 end end as rank
 from unnest(v_items) with ordinality q(x,ord)
 ) z;
 update public.reader_collection_items ci set sort_order=q.pos*10 from unnest(v_items) with ordinality q(tid,pos)
 where ci.collection_id=p_collection and ci.translation_id=q.tid;
 return true;
end $$;
revoke all on function public.position_reader_collection_item(uuid,uuid,integer) from public;
grant execute on function public.position_reader_collection_item(uuid,uuid,integer) to authenticated;