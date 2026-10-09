grant update on public.reader_collection_items to authenticated;
drop policy if exists collection_items_update on public.reader_collection_items;
create policy collection_items_update on public.reader_collection_items for update to authenticated
 using (exists(select 1 from public.reader_collections c where c.id=collection_id and c.user_id=(select auth.uid())))
 with check (exists(select 1 from public.reader_collections c where c.id=collection_id and c.user_id=(select auth.uid())));
