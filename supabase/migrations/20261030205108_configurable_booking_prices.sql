-- Extend existing settings; no replacement order or payment tables.
alter table public.surge_pricing_settings add column if not exists booking_pricing jsonb;
update public.surge_pricing_settings set booking_pricing = '{"baseFare":4.49,"includedMiles":2,"perMile":1.2,"shoppingFee":3.99,"largeFee":0,"vanFee":0,"weatherFee":0,"serviceRadiusMiles":0}'::jsonb where id=true and booking_pricing is null;
-- Preserve existing shopping budget; administrators can explicitly raise it to £100.

-- Serialize customer decisions with the existing parent-order settlement lock.
create or replace function public.decide_shopping_substitution(p_id uuid,p_customer_id uuid,p_approved boolean)
returns void language plpgsql security definer set search_path=public as $$
declare v_sub public.shopping_substitutions%rowtype; v_job public.delivery_requests%rowtype;
begin
 select * into v_sub from shopping_substitutions where id=p_id;
 if not found then raise exception 'substitution_not_found'; end if;
 select * into v_job from delivery_requests where id=v_sub.delivery_id for update;
 if v_job.customer_id is distinct from p_customer_id or v_job.status<>'collected' or v_job.bfm_stage<>'shopping' or p_approved is null then raise exception 'not_active_customer_order'; end if;
 select * into v_sub from shopping_substitutions where id=p_id for update;
 if v_sub.customer_approved is not null then
   if v_sub.customer_approved=p_approved then return; end if;
   raise exception 'decision_already_recorded';
 end if;
 update shopping_substitutions set customer_approved=p_approved,customer_responded_at=now() where id=p_id;
 update shopping_items set status=case when p_approved then 'substituted' else 'unavailable' end where id=v_sub.shopping_item_id and delivery_id=v_job.id;
end $$;
revoke all on function public.decide_shopping_substitution(uuid,uuid,boolean) from public,anon,authenticated;
grant execute on function public.decide_shopping_substitution(uuid,uuid,boolean) to service_role;

create or replace function public.keep_newest_driver_location() returns trigger language plpgsql set search_path=public as $$
begin
 if new.updated_at < old.updated_at then return null; end if;
 return new;
end $$;
revoke all on function public.keep_newest_driver_location() from public,anon,authenticated;
drop trigger if exists keep_newest_driver_location on public.driver_locations;
create trigger keep_newest_driver_location before update on public.driver_locations for each row execute function public.keep_newest_driver_location();
