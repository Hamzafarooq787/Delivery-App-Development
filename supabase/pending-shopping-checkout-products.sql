-- Existing tables only. Deploy compatible application code before applying.
-- Accept Stripe bookings without a company-liquidity gate; protect purchase cards.
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
 -- Customer payment is independent of the business Issuing balance.
 -- Actual company-card capacity is reserved separately before purchases.

 insert into payments(customer_id,request_key,payment_method,status,amount,booking_draft) values(p_customer,p_key,'stripe','pending',p_amount,p_draft) returning id into result;
 return result;
end $$;
revoke all on function public.reserve_order_checkout(uuid,uuid,numeric,jsonb,numeric) from public,anon,authenticated;
grant execute on function public.reserve_order_checkout(uuid,uuid,numeric,jsonb,numeric) to service_role;

create or replace function public.reserve_company_shopping_card(p_id uuid,p_actor uuid,p_card text,p_available numeric)
returns uuid language plpgsql security definer set search_path=public as $$
declare job delivery_requests%rowtype; reserved numeric;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'not_authorized'; end if;
 if p_card is null or p_card !~ '^ic_[a-zA-Z0-9]+$' then raise exception 'invalid_card_reference'; end if;
 perform pg_advisory_xact_lock(hashtextextended('godrop_company_checkout_capacity',0));
 select * into job from delivery_requests where id=p_id for update;
 if not found or job.service_type<>'buy_for_me' or job.status not in ('accepted','collected') or job.driver_id is null or job.purchase_authorized_at is not null or job.bfm_stage in ('purchase_completed','heading_to_customer') then raise exception 'shopping_not_ready'; end if;
 if job.company_card_reference is not null and job.company_card_reference<>p_card then raise exception 'dedicated_card_already_assigned'; end if;
 perform 1 from payments where delivery_id=p_id and status='paid';
 if not found then raise exception 'confirmed_payment_required'; end if;
 if job.max_spend_approved is null or job.max_spend_approved<=0 or job.max_spend_approved>100 then raise exception 'invalid_shopping_budget'; end if;
 select coalesce(sum(coalesce(max_spend_approved,0)),0) into reserved
 from delivery_requests where id<>p_id and service_type='buy_for_me' and company_card_reference is not null
 and status not in ('cancelled','delivered') and shopping_hold_settled_at is null;
 if p_available is null or p_available::text in ('NaN','Infinity','-Infinity') or p_available<reserved+job.max_spend_approved then raise exception 'company_purchase_capacity_unavailable'; end if;
 update delivery_requests set company_card_reference=p_card where id=p_id;
 return p_id;
end $$;
revoke all on function public.reserve_company_shopping_card(uuid,uuid,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_company_shopping_card(uuid,uuid,text,numeric) to service_role;

-- The legacy wallet RPC uses the same configured product count as card checkout.
do $$ declare definition text; begin
 select pg_get_functiondef(oid) into definition from pg_proc where pronamespace='public'::regnamespace and proname='book_shopping_order_atomic';
 if definition is null then raise exception 'shopping_booking_baseline_missing'; end if;
 if position('not between 1 and 5' in definition)>0 then
  definition:=replace(definition,'not between 1 and 5','not between 1 and coalesce((select (booking_pricing->>''maxShoppingProducts'')::int from public.surge_pricing_settings where id=true),15)');
  execute definition;
 end if;
end $$;

update public.surge_pricing_settings set
 booking_pricing_history=booking_pricing_history||jsonb_build_array(jsonb_build_object('at',now(),'reason','Customer requested at least 15 shopping products','before',booking_pricing,'after',jsonb_set(booking_pricing,'{maxShoppingProducts}','15'::jsonb))),
 booking_pricing=jsonb_set(booking_pricing,'{maxShoppingProducts}','15'::jsonb),updated_at=now()
where id=true and coalesce((booking_pricing->>'maxShoppingProducts')::int,0)<15;
