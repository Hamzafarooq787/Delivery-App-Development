-- Review and apply to GoDrop only. Extends existing tables; creates no tables.
-- Existing shopping tables must already be provisioned. Financial handlers are
-- service-role only; callers must verify the customer's authenticated identity.
begin;
alter table public.delivery_requests add column if not exists launch_quote jsonb;
alter table public.payments add column if not exists service_amount numeric not null default 0,
 add column if not exists shopping_funds numeric not null default 0,
 add column if not exists processing_cost numeric,
 add column if not exists refunded_amount numeric not null default 0,
 add column if not exists receipt_refund_amount numeric not null default 0,
 add column if not exists receipt_refund_status text,
 add column if not exists funding_reference text;
alter table public.driver_earnings add column if not exists subsidy_amount numeric not null default 0;
create unique index if not exists godrop_checkout_session_unique on public.payments(stripe_session_id) where stripe_session_id is not null;

create or replace function public.godrop_launch_ready() returns boolean language sql set search_path=public as $$ select to_regprocedure('public.prepare_weekly_driver_payouts(timestamp with time zone)') is not null and to_regprocedure('public.claim_launch_receipt(uuid,uuid,text,numeric)') is not null and to_regprocedure('public.confirm_shopping_budget(uuid,uuid,uuid,text,text,numeric)') is not null and to_regprocedure('public.reserve_shopping_card_purchase(uuid,text,text,numeric)') is not null and to_regprocedure('public.respond_launch_substitution(uuid,uuid,boolean)') is not null and exists(select 1 from information_schema.columns where table_schema='public' and table_name='payouts' and column_name='transfer_attempted_at') $$;
revoke all on function public.godrop_launch_ready() from public,anon,authenticated;
grant execute on function public.godrop_launch_ready() to service_role;

create or replace function public.create_launch_booking(p_customer uuid,p_booking jsonb,p_quote jsonb) returns uuid
language plpgsql security definer set search_path=public as $$
declare v_id uuid; v_item jsonb; v_tracking text;
begin
 if p_customer is null or not exists(select 1 from users where id=p_customer and role='customer') then raise exception 'invalid_customer';end if;
 if (p_quote->>'totalCharge')::numeric<=0 or (p_quote->>'driverAmount')::numeric<0 then raise exception 'invalid_quote';end if;
 v_tracking := case when p_booking->>'service'='shopping' then 'BFM-' else 'TRK-' end || upper(substr(replace(gen_random_uuid()::text,'-',''),1,12));
 insert into delivery_requests(customer_id,tracking_number,pickup_address,pickup_lat,pickup_lng,delivery_address,delivery_lat,delivery_lng,item_description,item_photo_urls,package_size,price,base_price,surge_multiplier,discount_amount,promo_code,service_type,shop_name,shop_address,shop_lat,shop_lng,shop_instructions,service_fee,estimated_items_total,max_spend_approved,is_safe_confirmed,status,launch_quote)
 values(p_customer,v_tracking,p_booking->>'pickup_address',(p_booking->>'pickup_lat')::numeric,(p_booking->>'pickup_lng')::numeric,p_booking->>'delivery_address',(p_booking->>'delivery_lat')::numeric,(p_booking->>'delivery_lng')::numeric,p_booking->>'item_description',array(select jsonb_array_elements_text(coalesce(p_booking->'item_photo_urls','[]'::jsonb))),p_booking->>'package_size',(p_quote->>'serviceFees')::numeric,(p_quote->>'basePrice')::numeric,(p_quote->>'surgeMultiplier')::numeric,(p_quote->>'discountAmount')::numeric,p_quote->>'promoCode',case when p_booking->>'service'='shopping' then 'buy_for_me' else 'collect_and_deliver' end,p_booking->>'shop_name',p_booking->>'pickup_address',(p_booking->>'pickup_lat')::numeric,(p_booking->>'pickup_lng')::numeric,p_booking->>'shop_instructions',(p_quote->>'shoppingFee')::numeric,(p_quote->>'shoppingFunds')::numeric,(p_quote->>'shoppingFunds')::numeric,true,'requested',p_quote) returning id into v_id;
 if p_booking->>'service'='shopping' then
  for v_item in select * from jsonb_array_elements(p_booking->'items') loop
   insert into shopping_items(delivery_id,name,quantity,estimated_price,brand_size_variant,notes,photo_url,substitution_preference,status)
   values(v_id,v_item->>'name',(v_item->>'quantity')::integer,(v_item->>'estimated_price')::numeric,v_item->>'brand_size_variant',v_item->>'notes',v_item->>'photo_url',v_item->>'substitution_preference','pending');
  end loop;
 end if;
 insert into payments(delivery_id,amount,status,service_amount,shopping_funds) values(v_id,(p_quote->>'totalCharge')::numeric,'pending',(p_quote->>'serviceFees')::numeric,(p_quote->>'shoppingFunds')::numeric);
 return v_id;
end $$;
revoke all on function public.create_launch_booking(uuid,jsonb,jsonb) from public,anon,authenticated;
grant execute on function public.create_launch_booking(uuid,jsonb,jsonb) to service_role;

create or replace function public.confirm_launch_payment(p_delivery uuid,p_session text,p_intent text,p_pence bigint) returns boolean
language plpgsql security definer set search_path=public as $$
declare v_payment payments%rowtype; v_status text;
begin
 select status into v_status from delivery_requests where id=p_delivery for update;
 select * into v_payment from payments where delivery_id=p_delivery for update;
 if not found or v_payment.stripe_session_id is distinct from p_session or round(v_payment.amount*100)<>p_pence then raise exception 'payment_mismatch';end if;
 if v_payment.status in('paid','released') then return false;end if;
 if v_status='cancelled' then raise exception 'booking_cancelled';end if;
 if v_payment.status<>'pending' then raise exception 'payment_not_pending';end if;
 update payments set status='paid',paid_at=now(),stripe_payment_intent=p_intent where id=v_payment.id;
 -- Generates the delivery update only after confirmed payment.
 update delivery_requests set status='requested' where id=p_delivery;
 return true;
end $$;
revoke all on function public.confirm_launch_payment(uuid,text,text,bigint) from public,anon,authenticated;
grant execute on function public.confirm_launch_payment(uuid,text,text,bigint) to service_role;

-- A non-exposed helper verifies the authenticated driver's role before a paid lookup.
create schema if not exists godrop_private;
create or replace function godrop_private.driver_can_see_paid_job(p_delivery uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 if auth.uid() is null or not exists(select 1 from users u join driver_profiles d on d.id=u.id where u.id=auth.uid() and u.role='driver' and d.status='approved') then return false;end if;
 return exists(select 1 from payments where delivery_id=p_delivery and status in('paid','released'));
end $$;
revoke all on function godrop_private.driver_can_see_paid_job(uuid) from public,anon;
grant usage on schema godrop_private to authenticated;
grant execute on function godrop_private.driver_can_see_paid_job(uuid) to authenticated;
drop policy if exists "GoDrop paid driver visibility" on public.delivery_requests;
create policy "GoDrop paid driver visibility" on public.delivery_requests as restrictive for select to authenticated
 using (not exists(select 1 from users where id=auth.uid() and role='driver') or godrop_private.driver_can_see_paid_job(delivery_requests.id));
-- Prevent direct browser writes from altering authoritative launch snapshots.
create or replace function godrop_private.protect_launch_order() returns trigger language plpgsql set search_path=public as $$
begin
 if (old.launch_quote is not null or new.launch_quote is not null) and current_user not in('service_role','postgres') then raise exception 'launch_orders_are_server_managed';end if;
 return new;
end $$;
drop trigger if exists godrop_launch_order_guard on public.delivery_requests;
create trigger godrop_launch_order_guard before update on public.delivery_requests for each row execute function godrop_private.protect_launch_order();

commit;
