create or replace function public.queue_bank_payout_retry(p_id uuid,p_actor uuid,p_previous text,p_return text) returns void
language plpgsql security definer set search_path=public as $$
declare p payouts%rowtype; attempt integer;
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 perform 1 from surge_pricing_settings where id=(select id from surge_pricing_settings order by id limit 1) and (payout_worker_until is null or payout_worker_until<now()) for update;
 if not found then raise exception 'payout_worker_busy_retry_later'; end if;
 select * into p from payouts where id=p_id for update;
 if p.provider->>'payout_id' is distinct from p_previous or p.provider->>'state' not in ('failed','canceled') or p.provider->>'transfer_id' is null then raise exception 'payout_changed_or_not_failed'; end if;
 if coalesce(p_return,'') not like 'txn_%' then raise exception 'returned_funds_required'; end if;
 attempt:=coalesce((p.provider->>'attempt')::int,0)+1;
 if attempt>3 then raise exception 'repeated_bank_failure_requires_support'; end if;
 update payouts set status='approved',payment_reference=null,provider=(p.provider-'payout_id'-'payout_started_at'-'error'-'checked_at')||jsonb_build_object('attempt',attempt,'state','awaiting_bank_payout','history',coalesce(p.provider->'history','[]'::jsonb)||jsonb_build_array(jsonb_build_object('payout_id',p_previous,'state',p.provider->>'state','returned_transaction',p_return,'actor',p_actor,'at',now()))) where id=p_id;
 update driver_earnings set status='reserved' where payout_id=p_id;
end $$;
revoke all on function public.queue_bank_payout_retry(uuid,uuid,text,text) from public,anon,authenticated;
grant execute on function public.queue_bank_payout_retry(uuid,uuid,text,text) to service_role;

create or replace function public.save_bank_payout(p_id uuid,p_provider jsonb) returns void
language plpgsql security definer set search_path=public as $$
declare p payouts%rowtype;
begin
 select * into p from payouts where id=p_id for update;
 if p.provider is null or p.provider->>'account' is distinct from p_provider->>'account' then raise exception 'bank_account_mismatch'; end if;
 if coalesce((p.provider->>'attempt')::int,0)<>coalesce((p_provider->>'attempt')::int,0) then raise exception 'stale_payout_attempt'; end if;
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

