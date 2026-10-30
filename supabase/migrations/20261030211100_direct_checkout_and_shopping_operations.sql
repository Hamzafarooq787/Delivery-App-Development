create unique index if not exists driver_earnings_delivery_unique on public.driver_earnings(delivery_id);
-- Existing tables only. Checkout drafts never enter the dispatch pool.
alter table public.payments add column if not exists customer_id uuid references public.users(id);
alter table public.payments add column if not exists request_key uuid;
alter table public.payments add column if not exists booking_draft jsonb;
alter table public.payments add column if not exists payment_method text default 'wallet';
alter table public.payments add column if not exists refund_jobs jsonb not null default '[]';
create unique index if not exists checkout_request_once on public.payments(customer_id,request_key);
alter table public.delivery_requests add column if not exists payment_method text default 'wallet';
alter table public.delivery_requests add column if not exists driver_earning_quote numeric;
alter table public.delivery_requests add column if not exists distance_miles numeric;
alter table public.delivery_requests add column if not exists duration_min numeric;
alter table public.delivery_requests add column if not exists shopping_started_at timestamptz;
alter table public.delivery_requests add column if not exists company_card_reference text;
alter table public.delivery_requests add column if not exists company_card_verified_at timestamptz;
create unique index if not exists dedicated_shopping_card_once on public.delivery_requests(company_card_reference) where company_card_reference is not null;
alter table public.delivery_requests add column if not exists shopping_problem text;
alter table public.delivery_requests add column if not exists shopping_limits jsonb;
alter table public.delivery_requests add column if not exists pickup_instructions text;
alter table public.delivery_requests add column if not exists delivery_instructions text;

create or replace function public.finalize_direct_checkout(p_payment_id uuid,p_session_id text,p_intent text,p_amount numeric)
returns jsonb language plpgsql security definer set search_path=public as $$
declare p payments%rowtype; d jsonb; o delivery_requests%rowtype; i jsonb;
begin
 select * into p from payments where id=p_payment_id for update;
 if not found or p.payment_method<>'stripe' or p.amount is distinct from p_amount or p.stripe_session_id is distinct from p_session_id or p_intent is null then raise exception 'payment_mismatch'; end if;
 if p.status='paid' and p.delivery_id is not null then select * into o from delivery_requests where id=p.delivery_id; return jsonb_build_object('id',o.id,'tracking_number',o.tracking_number,'service_type',o.service_type,'replayed',true); end if;
 if p.status<>'pending' or p.customer_id is null or p.booking_draft is null then raise exception 'invalid_payment_state'; end if;
 d:=p.booking_draft;
 if (d->>'price')::numeric + coalesce((d->>'max_spend_approved')::numeric,0) <> p.amount then raise exception 'invalid_breakdown'; end if;
 insert into delivery_requests(customer_id,tracking_number,service_type,pickup_address,pickup_lat,pickup_lng,delivery_address,delivery_lat,delivery_lng,item_description,item_photo_urls,package_size,status,price,base_price,surge_multiplier,discount_amount,is_safe_confirmed,payment_method,shop_name,shop_address,shop_lat,shop_lng,shop_instructions,service_fee,estimated_items_total,max_spend_approved,driver_earning_quote,distance_miles,duration_min)
 values(p.customer_id,d->>'tracking_number',d->>'service_type',d->>'pickup_address',(d->>'pickup_lat')::numeric,(d->>'pickup_lng')::numeric,d->>'delivery_address',(d->>'delivery_lat')::numeric,(d->>'delivery_lng')::numeric,d->>'item_description',array(select jsonb_array_elements_text(coalesce(d->'item_photo_urls','[]'))),d->>'package_size','requested',(d->>'price')::numeric,(d->>'base_price')::numeric,(d->>'surge_multiplier')::numeric,(d->>'discount_amount')::numeric,true,'stripe',d->>'shop_name',d->>'shop_address',(d->>'shop_lat')::numeric,(d->>'shop_lng')::numeric,d->>'shop_instructions',(d->>'service_fee')::numeric,(d->>'estimated_items_total')::numeric,(d->>'max_spend_approved')::numeric,(d->>'driver_earning_quote')::numeric,(d->>'distance_miles')::numeric,(d->>'duration_min')::numeric) returning * into o;
 update delivery_requests set shopping_limits=d->'shopping_limits',pickup_instructions=d->>'pickup_instructions',delivery_instructions=d->>'delivery_instructions' where id=o.id;
 for i in select value from jsonb_array_elements(coalesce(d->'shopping_items','[]')) loop
 insert into shopping_items(delivery_id,name,quantity,estimated_price,brand_size_variant,notes,photo_url,substitution_preference,status) values(o.id,i->>'name',(i->>'quantity')::int,(i->>'estimated_price')::numeric,i->>'brand_size_variant',i->>'notes',i->>'photo_url',i->>'substitution_preference','pending');
 end loop;
 if d->>'promo_code_id' is not null then
  insert into promo_code_redemptions(promo_code_id,user_id,delivery_id,discount_amount) values((d->>'promo_code_id')::uuid,p.customer_id,o.id,(d->>'discount_amount')::numeric);
 end if;
 update payments set status='paid',paid_at=now(),delivery_id=o.id,stripe_payment_intent=p_intent where id=p.id;
 return jsonb_build_object('id',o.id,'tracking_number',o.tracking_number,'service_type',o.service_type,'replayed',false);
end $$;
revoke all on function public.finalize_direct_checkout(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.finalize_direct_checkout(uuid,text,text,numeric) to service_role;

create or replace function public.queue_order_refund(p_delivery_id uuid,p_key text,p_amount numeric)
returns void language plpgsql security definer set search_path=public as $$
declare p payments%rowtype; total numeric;
begin
 select * into p from payments where delivery_id=p_delivery_id and payment_method='stripe' and status='paid' for update;
 if not found then raise exception 'paid_card_payment_required'; end if;
 if exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'key'=p_key) then return; end if;
 select coalesce(sum((r->>'amount')::numeric),0) into total from jsonb_array_elements(p.refund_jobs) r where r->>'state' not in ('failed','canceled');
 if p_amount is null or p_amount::text in ('NaN','Infinity','-Infinity') or p_amount<=0 or total+p_amount>p.amount then raise exception 'invalid_refund_amount'; end if;
 update payments set refund_jobs=refund_jobs||jsonb_build_array(jsonb_build_object('key',p_key,'amount',p_amount,'state','pending')) where id=p.id;
end $$;
revoke all on function public.queue_order_refund(uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.queue_order_refund(uuid,text,numeric) to service_role;

create or replace function public.record_order_refund(p_payment_id uuid,p_key text,p_refund_id text,p_state text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if p_state not in ('pending','requires_action','succeeded','failed','canceled') then raise exception 'invalid_refund_state'; end if;
 perform 1 from payments where id=p_payment_id for update;
 update payments set refund_jobs=(select jsonb_agg(case when r->>'key'=p_key and r->>'state' not in ('succeeded','failed','canceled') then r||jsonb_build_object('stripe_refund_id',p_refund_id,'state',p_state) else r end) from jsonb_array_elements(refund_jobs) r) where id=p_payment_id;
end $$;
revoke all on function public.record_order_refund(uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.record_order_refund(uuid,text,text,text) to service_role;

-- Legacy wallet refund functions must never credit a card-paid order.
do $$ declare n text; def text; begin
 foreach n in array array['handle_driver_cancellation','refund_cancelled_shopping_hold'] loop
 select pg_get_functiondef(oid) into def from pg_proc where pronamespace='public'::regnamespace and proname=n;
 if def is null then raise exception 'Required refund baseline missing: %',n; end if;
 def:=regexp_replace(def,'\mBEGIN\M', 'BEGIN IF new.payment_method = ''stripe'' THEN RETURN new; END IF;', 'i');
 execute def;
 end loop;
 select pg_get_functiondef(oid) into def from pg_proc where pronamespace='public'::regnamespace and proname='cancel_delivery_order';
 def:=regexp_replace(def,'\mBEGIN\M','BEGIN IF EXISTS(SELECT 1 FROM public.delivery_requests WHERE id=p_delivery_id AND payment_method=''stripe'') THEN RAISE EXCEPTION ''use_card_cancellation''; END IF;','i');
 execute def;
 -- The existing receipt RPC keeps its parent lock and receipt/item guards.
 select pg_get_functiondef(oid) into def from pg_proc where pronamespace='public'::regnamespace and proname='settle_shopping_receipt_atomic';
 if position('if v_refund>0 then' in def)=0 then raise exception 'Unexpected receipt baseline'; end if;
 def:=replace(def,'if v_refund>0 then','if v_refund>0 and v_order.payment_method=''stripe'' then perform public.queue_order_refund(p_delivery_id,''unused-shopping'',v_refund); end if; if v_refund>0 and v_order.payment_method<>''stripe'' then');
 execute def;
end $$;

create or replace function public.cancel_card_order(p_id uuid,p_actor uuid)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype; actor_role text; p payments%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 select role into actor_role from users where id=p_actor;
 if o.id is null or (o.customer_id is distinct from p_actor and o.driver_id is distinct from p_actor and actor_role is distinct from 'admin') then raise exception 'not_authorized'; end if;
 if o.payment_method<>'stripe' then raise exception 'not_card_order'; end if;
 if o.status='cancelled' then return jsonb_build_object('refund_queued',true); end if;
 if o.status not in ('requested','accepted') or o.bfm_stage in ('shopping','purchase_completed','heading_to_customer') then raise exception 'contact_support_after_collection'; end if;
 select * into p from payments where delivery_id=o.id and payment_method='stripe' and status='paid' for update;
 perform queue_order_refund(o.id,'cancel-order',p.amount);
 update delivery_requests set status='cancelled',cancelled_by=case when actor_role='admin' then 'admin' when o.customer_id=p_actor then 'customer' else 'driver' end,shopping_hold_settled_at=case when service_type='buy_for_me' then now() else shopping_hold_settled_at end where id=o.id;
 return jsonb_build_object('refund_queued',true,'amount',p.amount);
end $$;
revoke all on function public.cancel_card_order(uuid,uuid) from public,anon,authenticated;
grant execute on function public.cancel_card_order(uuid,uuid) to service_role;

update public.surge_pricing_settings set booking_pricing='{"maxShoppingProducts":5,"maxQuantityPerProduct":10,"maxShoppingWeightKg":15,"maxShoppingDimensionCm":60,"commissionPercent":20,"minimumDriverEarnings":4.49}'::jsonb||booking_pricing where id=true;
create or replace function public.snapshot_driver_earnings() returns trigger language plpgsql set search_path=public as $$
declare config jsonb;
begin
 select booking_pricing into config from surge_pricing_settings where id=true;
 new.driver_earning_quote:=round(greatest(new.price*(1-coalesce((config->>'commissionPercent')::numeric,20)/100),coalesce((config->>'minimumDriverEarnings')::numeric,4.49)),2);
 return new;
end $$;
revoke all on function public.snapshot_driver_earnings() from public,anon,authenticated;
create trigger snapshot_driver_earnings before insert on public.delivery_requests for each row execute function public.snapshot_driver_earnings();
create or replace function public.record_completed_earnings() returns trigger language plpgsql security definer set search_path=public as $$
declare earning numeric;
begin
 if new.status='delivered' and old.status<>'delivered' then
  earning:=coalesce(new.driver_earning_quote,round(new.price*0.75,2));
  insert into driver_earnings(driver_id,delivery_id,amount,commission_amount,status) values(new.driver_id,new.id,earning,new.price-earning,'pending') on conflict(delivery_id) do nothing;
 end if;
 return new;
end $$;
revoke all on function public.record_completed_earnings() from public,anon,authenticated;
create trigger record_completed_earnings after update on public.delivery_requests for each row execute function public.record_completed_earnings();

create or replace function public.complete_order_with_otp(p_id uuid,p_driver uuid,p_code text,p_photo text)
returns jsonb language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype; code delivery_otps%rowtype;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_driver or o.status<>'in_transit' or length(coalesce(p_photo,''))=0 then return jsonb_build_object('error','Order is not ready for completion'); end if;
 select * into code from delivery_otps where delivery_id=p_id for update;
 if not found or code.attempts>=5 then return jsonb_build_object('error','Contact support for a new delivery code'); end if;
 if trim(p_code) is distinct from code.otp then
  update delivery_otps set attempts=attempts+1 where delivery_id=p_id;
  return jsonb_build_object('error','Incorrect delivery code','attemptsRemaining',greatest(0,4-code.attempts));
 end if;
 update delivery_requests set status='delivered',delivered_at=now(),delivered_image_url=p_photo where id=p_id;
 update delivery_otps set verified_at=now() where delivery_id=p_id;
 insert into delivery_status_logs(delivery_id,status,updated_by) values(p_id,'delivered',p_driver);
 return jsonb_build_object('success',true);
end $$;
revoke all on function public.complete_order_with_otp(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.complete_order_with_otp(uuid,uuid,text,text) to service_role;

alter table public.shopping_items add column if not exists confirmed_unit_price numeric;
alter table public.delivery_requests add column if not exists purchase_authorized_total numeric;
alter table public.delivery_requests add column if not exists purchase_authorized_at timestamptz;
create or replace function public.prepare_company_purchase(p_id uuid,p_driver uuid)
returns numeric language plpgsql security definer set search_path=public as $$
declare o delivery_requests%rowtype; i shopping_items%rowtype; approved_price numeric; total numeric:=0;
begin
 select * into o from delivery_requests where id=p_id for update;
 if not found or o.driver_id is distinct from p_driver or o.status<>'collected' or o.bfm_stage<>'shopping' or o.company_card_verified_at is null then raise exception 'shopping_not_ready'; end if;
 if o.purchase_authorized_at is not null then return o.purchase_authorized_total; end if;
 for i in select * from shopping_items where delivery_id=p_id loop
  if i.status='unavailable' then continue; end if;
  if i.status not in ('purchased','substituted') then raise exception 'resolve_all_items_first'; end if;
  if exists(select 1 from shopping_substitutions where shopping_item_id=i.id and customer_approved=false) then raise exception 'rejected_item_must_be_unavailable'; end if;
  if exists(select 1 from shopping_substitutions where shopping_item_id=i.id and customer_approved is null) then raise exception 'customer_approval_pending'; end if;
  select suggested_price into approved_price from shopping_substitutions where shopping_item_id=i.id and customer_approved=true order by customer_responded_at desc limit 1;
  if i.status='substituted' then
   if approved_price is null then raise exception 'replacement_requires_approval'; end if;
  else
   if i.confirmed_unit_price is null or i.confirmed_unit_price<0 then raise exception 'confirm_shelf_prices_first'; end if;
   if i.confirmed_unit_price>coalesce(approved_price,i.estimated_price,0) then raise exception 'higher_price_requires_approval'; end if;
   approved_price:=i.confirmed_unit_price;
  end if;
  total:=total+round(approved_price*i.quantity,2);
 end loop;
 if total<0 or total>o.max_spend_approved then raise exception 'purchase_outside_approved_budget'; end if;
 update delivery_requests set purchase_authorized_total=total,purchase_authorized_at=now() where id=p_id;
 return total;
end $$;
revoke all on function public.prepare_company_purchase(uuid,uuid) from public,anon,authenticated;
grant execute on function public.prepare_company_purchase(uuid,uuid) to service_role;
create or replace function public.freeze_authorized_basket() returns trigger language plpgsql set search_path=public as $$
declare authorized timestamptz;
begin
 select purchase_authorized_at into authorized from delivery_requests where id=new.delivery_id for update;
 if authorized is not null then raise exception 'purchase_basket_locked'; end if;
 return new;
end $$;
create trigger freeze_purchase_items before insert or update on shopping_items for each row execute function freeze_authorized_basket();
create trigger freeze_purchase_decisions before insert or update on shopping_substitutions for each row execute function freeze_authorized_basket();

-- Driver verification, vehicle suitability and payment are checked under the same
-- transaction as assignment, closing the read/check/update race in application code.
create or replace function public.guard_driver_assignment() returns trigger language plpgsql security definer set search_path=public as $$
declare approved text; suitable boolean:=false; vehicle record;
begin
 if old.company_card_reference is not null and new.driver_id is distinct from old.driver_id then raise exception 'cancel_funded_shopping_before_reassignment'; end if;
 if new.driver_id is null or (new.driver_id is not distinct from old.driver_id and not(old.status='requested' and new.status='accepted')) then return new; end if;
 select status into approved from driver_profiles where id=new.driver_id for share;
 if approved is distinct from 'approved' then raise exception 'driver_not_approved'; end if;
 for vehicle in select vehicle_type from driver_vehicles where driver_id=new.driver_id for share loop
  if vehicle.vehicle_type='van' or (vehicle.vehicle_type='car' and new.package_size in ('small','medium','large')) or (vehicle.vehicle_type='motorcycle' and new.package_size in ('small','medium')) or (vehicle.vehicle_type='bicycle' and new.package_size='small') then suitable:=true; end if;
 end loop;
 if not suitable then raise exception 'suitable_vehicle_required'; end if;
 perform 1 from payments where delivery_id=new.id and status='paid' for share;
 if not found then raise exception 'confirmed_payment_required'; end if;
 return new;
end $$;
revoke all on function public.guard_driver_assignment() from public,anon,authenticated;
create trigger guard_driver_assignment before update on delivery_requests for each row execute function public.guard_driver_assignment();

create or replace function public.reserve_order_checkout(p_customer uuid,p_key uuid,p_amount numeric,p_draft jsonb,p_funds_available numeric default null)
returns uuid language plpgsql security definer set search_path=public as $$
declare existing uuid; reserved numeric; result uuid; promo promo_codes%rowtype; uses_total int; uses_customer int;
begin
 perform pg_advisory_xact_lock(hashtextextended('godrop_company_checkout_capacity',0));
 select id into existing from payments where customer_id=p_customer and request_key=p_key;
 if found then return existing; end if;
 if p_amount<=0 or p_amount::text in ('NaN','Infinity','-Infinity') or (p_draft->>'price')::numeric+coalesce((p_draft->>'max_spend_approved')::numeric,0) is distinct from p_amount then raise exception 'invalid_checkout'; end if;
 if p_draft->>'promo_code_id' is not null then
  select * into promo from promo_codes where id=(p_draft->>'promo_code_id')::uuid for update;
  if not found or not promo.active or promo.valid_from>now() or promo.valid_until<now() then raise exception 'discount_unavailable'; end if;
  select count(*),count(*) filter(where user_id=p_customer) into uses_total,uses_customer from promo_code_redemptions where promo_code_id=promo.id;
  select uses_total+count(*),uses_customer+count(*) filter(where customer_id=p_customer) into uses_total,uses_customer from payments where status='pending' and created_at>now()-interval '24 hours' and booking_draft->>'promo_code_id'=promo.id::text;
  if (promo.usage_limit_total is not null and uses_total>=promo.usage_limit_total) or uses_customer>=promo.usage_limit_per_user then raise exception 'discount_exhausted'; end if;
 end if;
 if p_draft->>'discount_campaign' is not null then
  if exists(select 1 from payments where customer_id=p_customer and booking_draft->>'discount_campaign'=p_draft->>'discount_campaign' and (status='paid' or (status='pending' and created_at>now()-interval '24 hours'))) then raise exception 'discount_already_reserved'; end if;
  if p_draft->>'discount_campaign'='first_order' and exists(select 1 from delivery_requests where customer_id=p_customer) then raise exception 'discount_no_longer_eligible'; end if;
 end if;
 if p_draft->>'service_type'='buy_for_me' then
  select coalesce(sum((p.booking_draft->>'max_spend_approved')::numeric),0) into reserved
  from payments p left join delivery_requests d on d.id=p.delivery_id
  where p.payment_method='stripe' and p.booking_draft->>'service_type'='buy_for_me'
  and ((p.status='pending' and p.created_at>now()-interval '24 hours') or (p.status='paid' and d.status not in ('cancelled','delivered') and d.shopping_hold_settled_at is null));
  if p_funds_available is null or p_funds_available<reserved+(p_draft->>'max_spend_approved')::numeric then raise exception 'company_purchase_capacity_unavailable'; end if;
 end if;
 insert into payments(customer_id,request_key,payment_method,status,amount,booking_draft) values(p_customer,p_key,'stripe','pending',p_amount,p_draft) returning id into result;
 return result;
end $$;
revoke all on function public.reserve_order_checkout(uuid,uuid,numeric,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.reserve_order_checkout(uuid,uuid,numeric,jsonb,numeric) to service_role;

alter table public.surge_pricing_settings add column if not exists booking_pricing_history jsonb not null default '[]';
create or replace function public.save_booking_pricing(p_actor uuid,p_config jsonb)
returns void language plpgsql security definer set search_path=public as $$
declare previous jsonb;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'not_authorized'; end if;
 select booking_pricing into previous from surge_pricing_settings where id=true for update;
 if not found then raise exception 'settings_missing'; end if;
 update surge_pricing_settings set booking_pricing=p_config,updated_at=now(),booking_pricing_history=booking_pricing_history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'before',previous,'after',p_config)) where id=true;
end $$;
revoke all on function public.save_booking_pricing(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_booking_pricing(uuid,jsonb) to service_role;
create or replace function public.queue_admin_card_refund(p_id uuid,p_actor uuid,p_amount numeric,p_reason text,p_key text)
returns void language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from users where id=p_actor and role='admin') or length(trim(p_reason)) not between 1 and 500 then raise exception 'not_authorized_or_invalid_reason'; end if;
 perform queue_order_refund(p_id,'admin:'||p_key,p_amount);
 update payments set refund_jobs=(select jsonb_agg(case when r->>'key'='admin:'||p_key then r||jsonb_build_object('actor',p_actor,'reason',p_reason) else r end) from jsonb_array_elements(refund_jobs) r) where delivery_id=p_id and payment_method='stripe';
end $$;
revoke all on function public.queue_admin_card_refund(uuid,uuid,numeric,text,text) from public,anon,authenticated;
grant execute on function public.queue_admin_card_refund(uuid,uuid,numeric,text,text) to service_role;

alter table public.payments add column if not exists processing_fee numeric;
create or replace function public.card_payment_summary()
returns jsonb language sql security definer set search_path=public as $$
 select jsonb_build_object(
 'customerPayments',coalesce(sum(p.amount),0),
 'shoppingFunds',coalesce(sum(coalesce((p.booking_draft->>'max_spend_approved')::numeric,0)),0),
 'serviceFees',coalesce(sum((p.booking_draft->>'price')::numeric),0),
 'processingFees',coalesce(sum(p.processing_fee),0),
 'unconfirmedProcessingFees',count(*) filter(where p.processing_fee is null),
 'refundsCompleted',coalesce(sum((select sum((r->>'amount')::numeric) from jsonb_array_elements(p.refund_jobs) r where r->>'state'='succeeded')),0),
 'refundsPending',coalesce(sum((select sum((r->>'amount')::numeric) from jsonb_array_elements(p.refund_jobs) r where r->>'state' in ('pending','requires_action'))),0)
 ) from payments p where p.payment_method='stripe' and p.status='paid';
$$;
revoke all on function public.card_payment_summary() from public,anon,authenticated;
grant execute on function public.card_payment_summary() to service_role;
-- Preserve the accepted quote even while an older application instance is draining.
create or replace function public.enforce_earning_snapshot() returns trigger language plpgsql set search_path=public as $$
declare quoted numeric; service_price numeric;
begin
 select driver_earning_quote,price into quoted,service_price from delivery_requests where id=new.delivery_id;
 if quoted is not null then new.amount:=quoted;new.commission_amount:=service_price-quoted;end if;
 return new;
end $$;
revoke all on function public.enforce_earning_snapshot() from public,anon,authenticated;
create trigger enforce_earning_snapshot before insert or update on driver_earnings for each row execute function enforce_earning_snapshot();
alter table public.payments add column if not exists refund_checked_at timestamptz;
create or replace function public.pending_card_refund_orders()
returns table(delivery_id uuid) language sql security definer set search_path=public as $$
 select p.delivery_id from payments p where p.payment_method='stripe' and p.delivery_id is not null and exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'state' in ('pending','requires_action')) order by p.refund_checked_at asc nulls first,p.created_at asc limit 20;
$$;
revoke all on function public.pending_card_refund_orders() from public,anon,authenticated;
grant execute on function public.pending_card_refund_orders() to service_role;
