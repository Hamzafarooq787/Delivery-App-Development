begin;
alter table public.payments add column if not exists issuing_authorizations jsonb not null default '[]'::jsonb;
create or replace function public.reserve_shopping_card_purchase(p_delivery uuid,p_card text,p_authorization text,p_amount numeric) returns boolean
language plpgsql security definer set search_path=public as $$
declare d delivery_requests%rowtype;p payments%rowtype;v_reserved numeric;v_allowed numeric;v_entry jsonb;
begin
 select * into d from delivery_requests where id=p_delivery for update;
 select * into p from payments where delivery_id=p_delivery for update;
 if d.id is null or d.driver_id is null or d.launch_quote is null or d.service_type<>'buy_for_me' or d.bfm_stage<>'shopping' or d.status='cancelled' or p.status<>'paid' or p.funding_reference is distinct from p_card or p_amount<=0 then return false;end if;
 if exists(select 1 from shopping_substitutions s where s.delivery_id=p_delivery and s.customer_approved is distinct from true and not exists(select 1 from shopping_items i where i.id=s.shopping_item_id and i.status='unavailable')) then return false;end if;
 if exists(select 1 from shopping_items where delivery_id=p_delivery and status<>'unavailable' and (found_unit_price is null or status='pending')) then return false;end if;
 if exists(select 1 from shopping_items i where i.delivery_id=p_delivery and i.status<>'unavailable' and i.found_unit_price>coalesce(i.estimated_price,0) and not exists(select 1 from shopping_substitutions s where s.shopping_item_id=i.id and s.customer_approved=true and s.suggested_price=i.found_unit_price)) then return false;end if;
 select coalesce(sum(found_unit_price*quantity),0) into v_allowed from shopping_items where delivery_id=p_delivery and status<>'unavailable';
 select coalesce(sum((e->>'amount')::numeric),0) into v_reserved from jsonb_array_elements(p.issuing_authorizations) e where e->>'id'<>p_authorization;
 if v_reserved+p_amount>least(p.shopping_funds,v_allowed) then return false;end if;
 select e into v_entry from jsonb_array_elements(p.issuing_authorizations) e where e->>'id'=p_authorization;
 if v_entry is not null then return (v_entry->>'amount')::numeric=p_amount;end if;
 update payments set issuing_authorizations=issuing_authorizations||jsonb_build_array(jsonb_build_object('id',p_authorization,'amount',p_amount)) where id=p.id;
 return true;
end $$;
revoke all on function public.reserve_shopping_card_purchase(uuid,text,text,numeric) from public,anon,authenticated;
grant execute on function public.reserve_shopping_card_purchase(uuid,text,text,numeric) to service_role;
commit;
