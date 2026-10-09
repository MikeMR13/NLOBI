create or replace function public.position_reader_collection_item(p_collection uuid,p_translation uuid,p_position integer)
returns boolean language plpgsql security invoker set search_path='' as $$
declare v_items uuid[];v_new uuid[];v_len integer;v_i integer;v_out integer:=1;
begin
 if not exists(select 1 from public.reader_collections where id=p_collection and user_id=(select auth.uid())) then return false; end if;
 select array_agg(translation_id order by sort_order,created_at,translation_id) into v_items from public.reader_collection_items where collection_id=p_collection;
 v_len:=coalesce(array_length(v_items,1),0);
 if v_len<2 or p_position<1 or p_position>v_len or not (p_translation=any(v_items)) then return false;end if;
 v_new:=array_fill(null::uuid,array[v_len]);
 for v_i in 1..v_len loop
  if v_i=p_position then v_new[v_i]:=p_translation;end if;
 end loop;
 for v_i in 1..v_len loop
  if v_items[v_i]<>p_translation then
   while v_new[v_out] is not null loop v_out:=v_out+1;end loop;
   v_new[v_out]:=v_items[v_i];
  end if;
 end loop;
 update public.reader_collection_items ci set sort_order=q.pos*10 from unnest(v_new) with ordinality q(tid,pos)
 where ci.collection_id=p_collection and ci.translation_id=q.tid;
 return true;
end $$;