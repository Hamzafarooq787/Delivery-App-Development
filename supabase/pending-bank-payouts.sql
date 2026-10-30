-- Extends existing ledgers. Provider operations are never treated as manual payments.
alter table public.driver_profiles add column if not exists stripe_connect_account_id text unique;
alter table public.driver_profiles add column if not exists stripe_connect_started_at timestamptz;
alter table public.payouts add column if not exists provider jsonb;
alter table public.surge_pricing_settings add column if not exists automatic_payouts boolean not null default false;
alter table public.surge_pricing_settings add column if not exists payout_worker_token uuid;
alter table public.surge_pricing_settings add column if not exists payout_worker_until timestamptz;

create or replace function public.protect_connect_account() returns trigger
language plpgsql set search_path=public as $$
begin
 if current_user in ('anon','authenticated') and
 ((TG_OP='INSERT' and (new.stripe_connect_account_id is not null or new.stripe_connect_started_at is not null)) or (TG_OP='UPDATE' and (new.stripe_connect_account_id is distinct from old.stripe_connect_account_id or new.stripe_connect_started_at is distinct from old.stripe_connect_started_at)))
 then raise exception 'server_managed_bank_account'; end if;
 return new;
end $$;
create trigger protect_connect_account before insert or update on public.driver_profiles for each row execute function public.protect_connect_account();

create or replace function public.begin_driver_connect(p_driver uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare d driver_profiles%rowtype;
begin
 select * into d from driver_profiles where id=p_driver and status='approved' for update;
 if not found then raise exception 'approved_driver_required'; end if;
 if d.stripe_connect_started_at is null then
 update driver_profiles set stripe_connect_started_at=now() where id=p_driver returning * into d;
 end if;
 return jsonb_build_object('account',d.stripe_connect_account_id,'started_at',d.stripe_connect_started_at);
end $$;
revoke all on function public.begin_driver_connect(uuid) from public,anon,authenticated;
grant execute on function public.begin_driver_connect(uuid) to service_role;

create or replace function public.claim_payout_worker(p_token uuid) returns boolean
language plpgsql security definer set search_path=public as $$
begin
 update surge_pricing_settings set payout_worker_token=p_token,payout_worker_until=now()+interval '5 minutes'
 where id=(select id from surge_pricing_settings order by id limit 1) and (payout_worker_until is null or payout_worker_until<now());
 return found;
end $$;
revoke all on function public.claim_payout_worker(uuid) from public,anon,authenticated;
grant execute on function public.claim_payout_worker(uuid) to service_role;

create or replace function public.start_bank_payout(p_id uuid,p_account text,p_token uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare p payouts%rowtype;
begin
 perform 1 from surge_pricing_settings where payout_worker_token=p_token and payout_worker_until>now() and automatic_payouts for update;
 if not found then raise exception 'payout_worker_not_enabled'; end if;
 select * into p from payouts where id=p_id for update;
 if p.provider is not null then return p.provider; end if;
 if p.status not in ('pending','approved') or p.earning_ids is null then raise exception 'payout_not_eligible'; end if;
 if exists(select 1 from payouts h where h.driver_id=p.driver_id and h.earning_ids is null and h.status in ('pending','approved','paid')) then raise exception 'historical_payouts_require_reconciliation'; end if;
 if not exists(select 1 from driver_profiles where id=p.driver_id and status='approved' and stripe_connect_account_id=p_account) then raise exception 'driver_bank_mismatch'; end if;
 if (select coalesce(sum(amount),0) from driver_earnings where payout_id=p.id and status='reserved')<>p.amount then raise exception 'earning_claim_mismatch'; end if;
 update payouts set status='approved',provider=jsonb_build_object('account',p_account,'state','processing','started_at',now()) where id=p_id returning * into p;
 return p.provider;
end $$;
revoke all on function public.start_bank_payout(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.start_bank_payout(uuid,text,uuid) to service_role;

create or replace function public.save_bank_payout(p_id uuid,p_provider jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare p payouts%rowtype;
begin
 select * into p from payouts where id=p_id for update;
 if p.provider is null or p.provider->>'account' is distinct from p_provider->>'account' then raise exception 'bank_account_mismatch'; end if;
 if p.provider->>'transfer_id' is not null and p.provider->>'transfer_id' is distinct from p_provider->>'transfer_id' then raise exception 'transfer_immutable'; end if;
 if p.provider->>'payout_id' is not null and p.provider->>'payout_id' is distinct from p_provider->>'payout_id' then raise exception 'bank_payout_immutable'; end if;
 if p_provider->>'state'='paid' then
  if p_provider->>'payout_id' is null or p_provider->>'transfer_id' is null then raise exception 'bank_confirmation_required'; end if;
  if (select coalesce(sum(amount),0) from driver_earnings where payout_id=p.id)<>p.amount then raise exception 'earning_claim_mismatch'; end if;
  update driver_earnings set status='paid' where payout_id=p.id;
 elsif p_provider->>'state' in ('failed','canceled') then
  -- A bank may return a payout previously reported as paid. Keep its liability reserved.
  update driver_earnings set status='reserved' where payout_id=p.id;
 end if;
 update payouts set provider=p_provider||jsonb_build_object('checked_at',now()),status=case when p_provider->>'state'='paid' then 'paid' else 'approved' end,
 payment_reference=case when p_provider->>'state'='paid' then p_provider->>'payout_id' else payment_reference end,
 processed_at=case when p_provider->>'state'='paid' then now() else processed_at end where id=p_id;
end $$;
revoke all on function public.save_bank_payout(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.save_bank_payout(uuid,jsonb) to service_role;

-- Keep the existing manual-review API, but never release provider-claimed earnings.
alter function public.review_driver_payout(uuid,uuid,text,text) rename to review_manual_driver_payout;
create function public.review_driver_payout(p_id uuid,p_actor uuid,p_status text,p_reference text default null) returns void
language plpgsql security definer set search_path=public as $$
begin
 perform 1 from payouts where id=p_id for update;
 if exists(select 1 from payouts where id=p_id and provider is not null) then raise exception 'provider_payment_requires_reconciliation'; end if;
 perform review_manual_driver_payout(p_id,p_actor,p_status,p_reference);
end $$;
revoke all on function public.review_manual_driver_payout(uuid,uuid,text,text) from public,anon,authenticated,service_role;
revoke all on function public.review_driver_payout(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.review_driver_payout(uuid,uuid,text,text) to service_role;

-- Conservative reserve: purchased goods stay excluded until a separate goods-funding
-- ledger is reconciled. This can hold back payouts, but cannot classify goods as revenue.
create or replace function public.payout_protected_funds() returns numeric
language sql security definer set search_path=public as $$
 select coalesce(sum(greatest(0,coalesce((p.booking_draft->>'max_spend_approved')::numeric,d.max_spend_approved,0)
 -coalesce((select sum((r->>'amount')::numeric) from jsonb_array_elements(p.refund_jobs) r where r->>'state'='succeeded' and r->>'key' in ('unused-shopping','cancel-order')),0))
 +coalesce((select sum((r->>'amount')::numeric) from jsonb_array_elements(p.refund_jobs) r where coalesce(r->>'state','pending') not in ('succeeded','canceled')),0)),0)
 from payments p left join delivery_requests d on d.id=p.delivery_id where p.payment_method='stripe' and p.status in ('paid','partially_refunded','refunded');
$$;
revoke all on function public.payout_protected_funds() from public,anon,authenticated;
grant execute on function public.payout_protected_funds() to service_role;

create or replace function public.bank_payout_queue(p_enabled boolean,p_id uuid default null) returns setof public.payouts
language sql security definer set search_path=public as $$
 select p.* from payouts p where
 ((p.provider is not null and (p_enabled or p.provider->>'payout_id' is not null)) or (p_enabled and p.status in ('pending','approved') and p.earning_ids is not null
 and exists(select 1 from driver_profiles d where d.id=p.driver_id and d.status='approved' and d.stripe_connect_account_id is not null)))
 and (p_id is null or p.id=p_id)
 order by coalesce(p.provider->>'checked_at',''),p.created_at,p.id limit 50;
$$;
revoke all on function public.bank_payout_queue(boolean,uuid) from public,anon,authenticated;
grant execute on function public.bank_payout_queue(boolean,uuid) to service_role;

create or replace function public.set_automatic_bank_payouts(p_actor uuid,p_enabled boolean) returns void
language plpgsql security definer set search_path=public as $$
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 if p_enabled is null then raise exception 'invalid_setting'; end if;
 update surge_pricing_settings set automatic_payouts=p_enabled,operations_history=operations_history||jsonb_build_array(jsonb_build_object('at',now(),'actor',p_actor,'automatic_payouts_before',automatic_payouts,'automatic_payouts_after',p_enabled))
 where id=(select id from surge_pricing_settings order by id limit 1);
 if not found then raise exception 'settings_missing'; end if;
end $$;
revoke all on function public.set_automatic_bank_payouts(uuid,boolean) from public,anon,authenticated;
grant execute on function public.set_automatic_bank_payouts(uuid,boolean) to service_role;

create or replace function public.admin_attention_queue(p_actor uuid) returns jsonb
language plpgsql security definer set search_path=public as $$
declare result jsonb;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 select coalesce(jsonb_agg(x),'[]') into result from (
 select id,reason,at,kind from (
 select d.id,'Shop problem reported'::text reason,d.created_at at,'order'::text kind from delivery_requests d where d.status not in ('cancelled','delivered') and d.shopping_problem is not null
 union all select s.delivery_id,'Customer approval pending',s.created_at,'order' from shopping_substitutions s join delivery_requests d on d.id=s.delivery_id where s.customer_approved is null and d.status not in ('cancelled','delivered')
 union all select p.delivery_id,'Card refund needs attention',p.created_at,'order' from payments p where p.delivery_id is not null and exists(select 1 from jsonb_array_elements(p.refund_jobs) r where r->>'state' in ('failed','requires_action'))

 union all select d.id,'Driver location missing or over 5 minutes old',d.created_at,'order' from delivery_requests d left join driver_locations l on l.driver_id=d.driver_id and l.delivery_id=d.id where d.status in ('accepted','collected','picked_up','in_transit') and (l.updated_at is null or l.updated_at<now()-interval '5 minutes')
 union all select d.id,'Shopping receipt missing',d.created_at,'order' from delivery_requests d where d.service_type='buy_for_me' and d.bfm_stage in ('purchase_completed','heading_to_customer','delivered') and d.receipt_url is null and d.status<>'cancelled'
 union all select p.id,'Bank payout needs reconciliation',p.created_at,'payout' from payouts p where p.provider->>'error' is not null or p.provider->>'state' in ('failed','canceled') or (p.provider is null and p.admin_note='historical_payouts_require_reconciliation')
 union all select p.delivery_id,'Card payment failed',p.created_at,'payment' from payments p where p.status='failed'
 ) q order by at,id limit 100) x;
 return result;
end $$;
revoke all on function public.admin_attention_queue(uuid) from public,anon,authenticated;
grant execute on function public.admin_attention_queue(uuid) to service_role;

-- Harden legacy helper functions identified by the database advisor. Trigger
-- invocation does not require client EXECUTE privileges. RLS is_admin remains
-- intentionally callable; it returns only the current actor's admin boolean.
do $$
declare f record;
begin
 for f in select p.oid::regprocedure signature,p.proname from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('generate_tracking_number','update_notification_token_updated_at','wallet_topup_fn_exists','create_shopping_request_with_wallet_payment') loop
  execute format('alter function %s set search_path=public',f.signature);
 end loop;
 for f in select p.oid::regprocedure signature from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname='public' and p.proname in ('generate_delivery_otp','handle_driver_cancellation','handle_new_user','notify_chat_message','notify_delivery_change','refund_cancelled_shopping_hold') and p.prorettype='trigger'::regtype loop
  execute format('revoke all on function %s from public,anon,authenticated',f.signature);
 end loop;
 if to_regprocedure('public.cancel_delivery_order(uuid)') is not null then
  revoke execute on function public.cancel_delivery_order(uuid) from public,anon;
  grant execute on function public.cancel_delivery_order(uuid) to authenticated,service_role;
 end if;
end $$;
