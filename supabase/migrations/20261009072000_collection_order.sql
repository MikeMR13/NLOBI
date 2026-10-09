alter table public.reader_collection_items add column if not exists sort_order integer not null default 0;
create index if not exists reader_collection_items_order_idx on public.reader_collection_items(collection_id,sort_order,created_at);
create or replace function public.move_reader_collection_item(p_collection uuid,p_translation uuid,p_direction integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_items uuid[];v_index integer;v_other uuid;
begin
 if p_direction not in (-1,1) then return false;end if;
 if not exists(select 1 from public.reader_collections where id=p_collection and user_id=(select auth.uid())) then return false;end if;
 select array_agg(translation_id order by sort_order,created_at,translation_id) into v_items from public.reader_collection_items where collection_id=p_collection;
 select i into v_index from generate_subscripts(v_items,1) g(i) where v_items[i]=p_translation;
 if v_index is null or v_index+p_direction<1 or v_index+p_direction>coalesce(array_length(v_items,1),0) then return false;end if;
 v_other:=v_items[v_index+p_direction];v_items[v_index+p_direction]:=p_translation;v_items[v_index]:=v_other;
 update public.reader_collection_items ci set sort_order=q.pos*10 from unnest(v_items) with ordinality q(tid,pos)
 where ci.collection_id=p_collection and ci.translation_id=q.tid;
 return true;
end $$;
revoke all on function public.move_reader_collection_item(uuid,uuid,integer) from public;
grant execute on function public.move_reader_collection_item(uuid,uuid,integer) to authenticated;