-- Review against the actual GoDrop schema before application. No new order/wallet tables.
begin;
alter table public.delivery_requests add column if not exists service_type text default 'delivery';
alter table public.delivery_requests add column if not exists shop_name text;
alter table public.delivery_requests add column if not exists shop_address text;
alter table public.delivery_requests add column if not exists shop_instructions text;
alter table public.delivery_requests add column if not exists shop_lat numeric;
alter table public.delivery_requests add column if not exists shop_lng numeric;
alter table public.delivery_requests add column if not exists bfm_stage text;
alter table public.delivery_requests add column if not exists service_fee numeric;
alter table public.delivery_requests add column if not exists estimated_items_total numeric;
alter table public.delivery_requests add column if not exists max_spend_approved numeric;
alter table public.delivery_requests add column if not exists actual_items_total numeric;
alter table public.delivery_requests add column if not exists receipt_url text;
alter table public.delivery_requests add column if not exists purchase_confirmed_at timestamptz;
alter table public.delivery_requests add column if not exists shopping_request_key uuid;
alter table public.delivery_requests add column if not exists shopping_hold_settled_at timestamptz;
create unique index if not exists shopping_request_once on public.delivery_requests(customer_id,shopping_request_key) where shopping_request_key is not null;
-- Missing shopping schema must be recovered from the authorized live project, not guessed.
do $$ begin
 if to_regclass('public.shopping_items') is null or to_regclass('public.shopping_substitutions') is null or to_regclass('public.bfm_settings') is null then
   raise exception 'Shopping baseline missing: recover existing shopping tables before applying this migration';
 end if;
end $$;
alter table public.bfm_settings add column if not exists enabled boolean;
do $$ begin
 if exists(select 1 from information_schema.columns where table_schema='public' and table_name='bfm_settings' and column_name='service_enabled') then
   execute 'update public.bfm_settings set enabled=service_enabled where enabled is null';
 end if;
end $$;
update public.bfm_settings set enabled=false where enabled is null;

create or replace function public.book_shopping_order_atomic(p_customer_id uuid,p_request_key uuid,p_order jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.delivery_requests%rowtype; v_balance numeric; v_price numeric; v_hold numeric; v_item jsonb; v_estimate numeric:=0;
begin
 if p_customer_id is null or p_request_key is null then raise exception 'invalid_customer_or_request'; end if;
 -- Serialize retries even when there is no existing order yet.
 perform pg_advisory_xact_lock(hashtextextended(p_customer_id::text||p_request_key::text,0));
 select * into v_order from delivery_requests where customer_id=p_customer_id and shopping_request_key=p_request_key;
 if found then return jsonb_build_object('id',v_order.id,'tracking_number',v_order.tracking_number,'replayed',true); end if;
 if jsonb_typeof(p_order->'shopping_items')<>'array' or jsonb_array_length(p_order->'shopping_items') not between 1 and 5 then raise exception 'invalid_items'; end if;
 for v_item in select value from jsonb_array_elements(p_order->'shopping_items') loop
   if length(trim(v_item->>'name')) not between 1 and 200 or (v_item->>'quantity')::numeric not between 1 and 99 or mod((v_item->>'quantity')::numeric,1)<>0 or coalesce((v_item->>'estimated_price')::numeric,0) not between 0 and 100 then raise exception 'invalid_item'; end if;
   v_estimate:=v_estimate+coalesce((v_item->>'estimated_price')::numeric,0)*(v_item->>'quantity')::numeric;
 end loop;
 v_price:=(p_order->>'price')::numeric; v_hold:=(p_order->>'max_spend_approved')::numeric;
 if v_price is null or v_price<0 or v_price>10000 or v_hold is null or v_hold<=0 or v_hold>100 or v_estimate>v_hold then raise exception 'invalid_budget'; end if;
 insert into wallet_balances(user_id,balance) values(p_customer_id,0) on conflict do nothing;
 select balance into v_balance from wallet_balances where user_id=p_customer_id for update;
 if v_balance<v_price+v_hold then raise exception 'insufficient_funds'; end if;
 insert into delivery_requests(customer_id,shopping_request_key,tracking_number,service_type,shop_name,shop_address,shop_instructions,shop_lat,shop_lng,pickup_address,pickup_lat,pickup_lng,delivery_address,delivery_lat,delivery_lng,status,package_size,price,base_price,service_fee,estimated_items_total,max_spend_approved,is_safe_confirmed)
 values(p_customer_id,p_request_key,p_order->>'tracking_number','buy_for_me',p_order->>'shop_name',p_order->>'shop_address',p_order->>'shop_instructions',(p_order->>'shop_lat')::numeric,(p_order->>'shop_lng')::numeric,p_order->>'shop_address',(p_order->>'shop_lat')::numeric,(p_order->>'shop_lng')::numeric,p_order->>'delivery_address',(p_order->>'delivery_lat')::numeric,(p_order->>'delivery_lng')::numeric,'requested','medium',v_price,(p_order->>'base_price')::numeric,(p_order->>'service_fee')::numeric,v_estimate,v_hold,true) returning * into v_order;
 for v_item in select value from jsonb_array_elements(p_order->'shopping_items') loop
 insert into shopping_items(delivery_id,name,quantity,estimated_price,brand_size_variant,notes,photo_url,substitution_preference,status)
 values(v_order.id,trim(v_item->>'name'),(v_item->>'quantity')::int,(v_item->>'estimated_price')::numeric,v_item->>'brand_size_variant',v_item->>'notes',v_item->>'photo_url',v_item->>'substitution_preference','pending');
 end loop;
 update wallet_balances set balance=balance-v_price-v_hold,updated_at=now() where user_id=p_customer_id;
 insert into wallet_transactions(user_id,type,amount,description,delivery_id) values
 (p_customer_id,'deduction',-v_price,'Shopping delivery/service fee',v_order.id),
 (p_customer_id,'deduction',-v_hold,'Shopping funds hold',v_order.id);
 insert into payments(delivery_id,amount,status) values(v_order.id,v_price,'paid');
 return jsonb_build_object('id',v_order.id,'tracking_number',v_order.tracking_number,'replayed',false);
end $$;
revoke all on function public.book_shopping_order_atomic(uuid,uuid,jsonb) from public,anon,authenticated;
grant execute on function public.book_shopping_order_atomic(uuid,uuid,jsonb) to service_role;

create or replace function public.settle_shopping_receipt_atomic(p_delivery_id uuid,p_driver_id uuid,p_receipt_url text,p_actual_total numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare v_order public.delivery_requests%rowtype; v_refund numeric;
begin
 select * into v_order from delivery_requests where id=p_delivery_id for update;
 if not found or v_order.driver_id is distinct from p_driver_id or v_order.service_type<>'buy_for_me' then raise exception 'not_your_order'; end if;
 if p_actual_total is null or p_actual_total::text in ('NaN','Infinity','-Infinity') or p_actual_total<0 or p_actual_total>v_order.max_spend_approved or p_receipt_url is null or length(trim(p_receipt_url))=0 then raise exception 'invalid_receipt'; end if;
 if v_order.shopping_hold_settled_at is not null then
   if v_order.actual_items_total=p_actual_total and v_order.receipt_url=p_receipt_url then return jsonb_build_object('refund',0,'replayed',true); end if;
   raise exception 'already_settled';
 end if;
 if v_order.status<>'collected' or v_order.bfm_stage<>'shopping' then raise exception 'invalid_stage'; end if;
 -- Item mutations/approval writes also lock the parent through the trigger below.
 if exists(select 1 from shopping_substitutions s join shopping_items i on i.id=s.shopping_item_id and i.delivery_id=s.delivery_id where s.delivery_id=p_delivery_id and (s.customer_approved is null or (s.customer_approved=false and i.status<>'unavailable'))) then raise exception 'unapproved_substitution'; end if;
 if exists(select 1 from shopping_items where delivery_id=p_delivery_id and status not in ('purchased','substituted','unavailable')) then raise exception 'items_not_resolved'; end if;
 v_refund:=round(v_order.max_spend_approved-p_actual_total,2);
 if v_refund>0 then
   insert into wallet_balances(user_id,balance) values(v_order.customer_id,0) on conflict do nothing;
   update wallet_balances set balance=balance+v_refund,updated_at=now() where user_id=v_order.customer_id;
   insert into wallet_transactions(user_id,type,amount,description,delivery_id) values(v_order.customer_id,'cashback',v_refund,'Unused shopping funds',p_delivery_id);
 end if;
 update delivery_requests set receipt_url=p_receipt_url,actual_items_total=p_actual_total,purchase_confirmed_at=now(),shopping_hold_settled_at=now(),bfm_stage='purchase_completed' where id=p_delivery_id;
 return jsonb_build_object('refund',v_refund,'replayed',false);
end $$;
revoke all on function public.settle_shopping_receipt_atomic(uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.settle_shopping_receipt_atomic(uuid,uuid,text,numeric) to service_role;

-- Prevent item/approval edits racing a purchase settlement.
create or replace function public.lock_shopping_parent() returns trigger language plpgsql set search_path=public as $$
declare v_status text; v_settled timestamptz;
begin
 select status,shopping_hold_settled_at into v_status,v_settled from delivery_requests where id=new.delivery_id for update;
 if v_settled is not null or v_status in ('cancelled','delivered') then raise exception 'shopping_order_closed'; end if;
 if TG_TABLE_NAME='shopping_substitutions' then
   if not exists(select 1 from shopping_items where id=new.shopping_item_id and delivery_id=new.delivery_id) then raise exception 'item_order_mismatch'; end if;
 end if;
 return new;
end $$;
drop trigger if exists lock_shopping_item_parent on shopping_items;
create trigger lock_shopping_item_parent before insert or update on shopping_items for each row execute function lock_shopping_parent();
drop trigger if exists lock_shopping_approval_parent on shopping_substitutions;
create trigger lock_shopping_approval_parent before insert or update on shopping_substitutions for each row execute function lock_shopping_parent();

-- Remove permissive legacy shopping policies, then allow scoped reads only.
do $$ declare t text; pol record; f record; begin
 foreach t in array array['shopping_items','shopping_substitutions','bfm_settings'] loop
   execute format('alter table public.%I enable row level security',t);
   for pol in select policyname from pg_policies where schemaname='public' and tablename=t loop
     execute format('drop policy %I on public.%I',pol.policyname,t);
   end loop;
   execute format('revoke all on public.%I from anon,authenticated',t);
   execute format('grant all on public.%I to service_role',t);
 end loop;
 -- Historical shopping booking functions accept caller-supplied prices.
 for f in select oid::regprocedure as signature from pg_proc where pronamespace='public'::regnamespace and proname='create_shopping_request_with_wallet_payment' loop
   execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
end $$;
-- The public bucket flag bypasses SELECT policies. Make driver documents private.
-- Bucket privacy is activated by the following migration AFTER app deployment.
drop policy if exists "Authenticated can read driver documents" on storage.objects;
drop policy if exists "Public can read driver documents" on storage.objects;
create policy "Owner or admin reads driver files" on storage.objects for select to authenticated using(bucket_id='driver-documents' and ((storage.foldername(name))[1]=auth.uid()::text or exists(select 1 from public.users where id=auth.uid() and role='admin')));
-- Refund only unsettled shopping funds on cancellation. The existing driver
-- cancellation trigger remains responsible for its service-fee cashback.
create or replace function public.refund_cancelled_shopping_hold() returns trigger language plpgsql security definer set search_path=public as $$
declare v_hold numeric;
begin
 if old.status<>'cancelled' and new.status='cancelled' and new.service_type='buy_for_me' and old.shopping_hold_settled_at is null then
   if old.bfm_stage in ('shopping','purchase_completed','heading_to_customer') then
     raise exception 'Shopping purchase must be reconciled before cancellation';
   end if;
   -- Legacy holds cannot be assumed funded: require their ledger entry.
   select abs(amount) into v_hold from wallet_transactions where delivery_id=new.id and type='deduction' and description like '%shopping funds hold%' limit 1;
   if v_hold is null then select abs(amount) into v_hold from wallet_transactions where delivery_id=new.id and type='deduction' and description='Shopping funds hold' limit 1; end if;
   if v_hold is null then raise exception 'Shopping hold requires reconciliation'; end if;
   update wallet_balances set balance=balance+v_hold,updated_at=now() where user_id=new.customer_id;
   insert into wallet_transactions(user_id,type,amount,description,delivery_id) values(new.customer_id,'cashback',v_hold,'Cancelled unused shopping hold',new.id);
   new.shopping_hold_settled_at:=now();
 end if;
 return new;
end $$;
drop trigger if exists refund_shopping_hold_on_cancel on delivery_requests;
create trigger refund_shopping_hold_on_cancel before update on delivery_requests for each row execute function refund_cancelled_shopping_hold();
create or replace function cancel_delivery_order(
  p_delivery_id uuid
) returns jsonb
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  v_customer_id uuid := auth.uid();
  v_delivery record;
  v_free_cancel boolean;
  v_deduction_amount numeric;
  v_refund_amount numeric := 0;
  v_cancellation_fee numeric := 0;
  v_distance_miles numeric := 0;
  v_label text;
begin
  if v_customer_id is null then
    raise exception 'not_authenticated';
  end if;

  select * into v_delivery
  from delivery_requests
  where id = p_delivery_id
  for update;

  if not found then
    raise exception 'not_found';
  end if;
  if v_delivery.customer_id <> v_customer_id then
    raise exception 'not_your_order';
  end if;
  if v_delivery.status in ('delivered', 'cancelled') then
    raise exception 'cannot_cancel';
  end if;

  v_label := coalesce('#' || v_delivery.tracking_number, '#' || upper(substring(p_delivery_id::text, 1, 8)));
  v_free_cancel := v_delivery.status in ('requested', 'accepted');

  if v_free_cancel then
    select amount into v_deduction_amount
    from wallet_transactions
    where delivery_id = p_delivery_id and type = 'deduction'
      and description not ilike '%shopping funds hold%'
    limit 1;

    if v_deduction_amount is not null then
      v_refund_amount := abs(v_deduction_amount);
      insert into wallet_balances (user_id, balance, updated_at)
      values (v_customer_id, v_refund_amount, now())
      on conflict (user_id) do update
        set balance = wallet_balances.balance + v_refund_amount,
            updated_at = now();
      insert into wallet_transactions (user_id, type, amount, description, delivery_id)
      values (v_customer_id, 'cashback', v_refund_amount, 'Refund for cancelled order ' || v_label, p_delivery_id);
    end if;
  else
    if v_delivery.pickup_lat is not null and v_delivery.pickup_lng is not null
       and v_delivery.delivery_lat is not null and v_delivery.delivery_lng is not null then
      v_distance_miles := 3958.8 * 2 * asin(least(1, sqrt(
        power(sin(radians(v_delivery.delivery_lat - v_delivery.pickup_lat) / 2), 2) +
        cos(radians(v_delivery.pickup_lat)) * cos(radians(v_delivery.delivery_lat)) *
        power(sin(radians(v_delivery.delivery_lng - v_delivery.pickup_lng) / 2), 2)
      )));
      v_cancellation_fee := ceil(v_distance_miles);
    else
      v_cancellation_fee := 5;
      v_distance_miles := 0;
    end if;

    insert into wallet_balances (user_id, balance, updated_at)
    values (v_customer_id, -v_cancellation_fee, now())
    on conflict (user_id) do update
      set balance = wallet_balances.balance - v_cancellation_fee,
          updated_at = now();

    insert into wallet_transactions (user_id, type, amount, description, delivery_id)
    values (
      v_customer_id, 'cancellation_fee', -v_cancellation_fee,
      'Cancellation fee for order ' || v_label || ' (' || round(v_distance_miles::numeric, 1) || ' miles x GBP1)',
      p_delivery_id
    );
  end if;

  update delivery_requests
  set status = 'cancelled', cancelled_by = 'customer'
  where id = p_delivery_id;

  insert into notifications (user_id, title, body)
  values (
    v_customer_id,
    case when v_free_cancel then 'Order Cancelled' else 'Order Cancelled — Fee Applied' end,
    case
      when v_free_cancel and v_refund_amount > 0 then
        'Your order has been cancelled and GBP' || to_char(v_refund_amount, 'FM999999990.00') || ' was refunded to your wallet.'
      when v_free_cancel then
        'Your order has been cancelled at no charge.'
      else
        'Your order was cancelled. A GBP' || v_cancellation_fee || ' cancellation fee was deducted from your wallet.'
    end
  );

  return jsonb_build_object(
    'freeCancel', v_free_cancel,
    'cancellationFee', v_cancellation_fee,
    'distanceMiles', v_distance_miles,
    'refundAmount', v_refund_amount
  );
end;
$$;

commit;
