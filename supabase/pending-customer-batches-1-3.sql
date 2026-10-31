-- Deploy compatible image readers before applying. Existing tables and files only.
-- Authorize exact order image references; never expose the service RPC to browsers.
create or replace function public.can_read_order_photo(p_user uuid,p_url text)
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from users where id=p_user and role='admin') or exists(
  select 1 from delivery_requests d where (d.customer_id=p_user or d.driver_id=p_user) and (
   (position('/public/delivery-item-photos/'||d.customer_id::text||'/' in p_url)>0 and
    (p_url=any(coalesce(d.item_photo_urls,'{}'::text[])) or exists(select 1 from shopping_items i where i.delivery_id=d.id and i.photo_url=p_url)))
   or (position('/public/delivery-item-photos/'||d.driver_id::text||'/' in p_url)>0 and
    (d.receipt_url=p_url or exists(select 1 from shopping_substitutions s where s.delivery_id=d.id and s.photo_url=p_url)))
  )
 );
$$;
revoke all on function public.can_read_order_photo(uuid,text) from public,anon,authenticated;
grant execute on function public.can_read_order_photo(uuid,text) to service_role;
drop policy if exists "customers read assigned driver location" on public.driver_locations;
create policy "customers read assigned driver location" on public.driver_locations for select to authenticated using (
 exists(select 1 from public.delivery_requests d where d.id=driver_locations.delivery_id and d.driver_id=driver_locations.driver_id and d.customer_id=(select auth.uid()) and d.status in ('accepted','collected','picked_up','in_transit'))
);
drop policy if exists "Public can read item photos" on storage.objects;
drop policy if exists "Owners read item photos" on storage.objects;
create policy "Owners read item photos" on storage.objects for select to authenticated using (
 bucket_id='delivery-item-photos' and (storage.foldername(name))[1]=(select auth.uid())::text
);
update storage.buckets set public=false where id='delivery-item-photos';
