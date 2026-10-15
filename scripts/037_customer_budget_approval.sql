begin;
alter table public.payments add column if not exists additional_payments jsonb not null default '[]'::jsonb;
create or replace function public.confirm_shopping_budget(p_delivery uuid,p_substitution uuid,p_customer uuid,p_session text,p_intent text,p_amount numeric) returns boolean
language plpgsql security definer set search_path=public as $$
declare d delivery_requests%rowtype;p payments%rowtype;s shopping_substitutions%rowtype;
begin
 select * into d from delivery_requests where id=p_delivery for update;
 select * into p from payments where delivery_id=p_delivery for update;
 select * into s from shopping_substitutions where id=p_substitution for update;
 if d.customer_id is distinct from p_customer or d.launch_quote is null or d.status in('cancelled','delivered') or s.delivery_id is distinct from p_delivery or p.status<>'paid' or p_amount<=0 then raise exception 'invalid_budget_payment';end if;
 if exists(select 1 from jsonb_array_elements(p.additional_payments) e where e->>'session'=p_session) then return false;end if;
 if s.customer_approved is not null then raise exception 'approval_already_answered';end if;
 if p.shopping_funds+p_amount>100 then raise exception 'shopping_limit_exceeded';end if;
 update payments set amount=amount+p_amount,shopping_funds=shopping_funds+p_amount,additional_payments=additional_payments||jsonb_build_array(jsonb_build_object('session',p_session,'intent',p_intent,'amount',p_amount)) where id=p.id;
 update delivery_requests set max_spend_approved=max_spend_approved+p_amount where id=p_delivery;
 update shopping_substitutions set customer_approved=true,customer_responded_at=now() where id=p_substitution;
 update shopping_items set status='substituted' where id=s.shopping_item_id;
 return true;
end $$;
revoke all on function public.confirm_shopping_budget(uuid,uuid,uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.confirm_shopping_budget(uuid,uuid,uuid,text,text,numeric) to service_role;
-- All direct responses also use the same order/payment lock as funding approval.
-- This prevents a direct action call from bypassing additional payment.
create or replace function public.respond_launch_substitution(p_substitution uuid,p_customer uuid,p_approved boolean) returns void
language plpgsql security definer set search_path=public as $$
declare d delivery_requests%rowtype;p payments%rowtype;s shopping_substitutions%rowtype;v_delivery uuid;v_projected numeric;
begin
 select delivery_id into v_delivery from shopping_substitutions where id=p_substitution;
 select * into d from delivery_requests where id=v_delivery for update;
 select * into p from payments where delivery_id=v_delivery for update;
 select * into s from shopping_substitutions where id=p_substitution for update;
 if d.id is null or d.customer_id is distinct from p_customer or d.launch_quote is null or d.status in('cancelled','delivered') or p.status is distinct from 'paid' or s.customer_approved is not null or p_approved is null then raise exception 'invalid_approval';end if;
 if p_approved then
  if s.suggested_price is null or s.suggested_price<0 then raise exception 'invalid_price';end if;
  select coalesce(sum((case when i.id=s.shopping_item_id then s.suggested_price else coalesce(i.found_unit_price,i.estimated_price,0) end)*i.quantity),0) into v_projected from shopping_items i where i.delivery_id=v_delivery and (i.status<>'unavailable' or i.id=s.shopping_item_id);
  if v_projected>least(p.shopping_funds,d.max_spend_approved,100) then raise exception 'additional_payment_required';end if;
 end if;
 update shopping_substitutions set customer_approved=p_approved,customer_responded_at=now() where id=p_substitution;
 update shopping_items set status=case when p_approved then 'substituted' else 'unavailable' end where id=s.shopping_item_id;
end $$;
revoke all on function public.respond_launch_substitution(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.respond_launch_substitution(uuid,uuid,boolean) to service_role;
commit;
