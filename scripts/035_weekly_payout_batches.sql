-- Apply after 034; extends existing earnings, payouts and profiles only.
begin;
alter table public.driver_profiles add column if not exists stripe_connect_account_id text,add column if not exists launch_agreement jsonb;
alter table public.payouts add column if not exists stripe_transfer_id text,add column if not exists paid_at timestamptz,add column if not exists failure_reason text,add column if not exists transfer_attempted_at timestamptz;
alter table public.driver_earnings add column if not exists payout_id uuid references public.payouts(id);
create or replace function public.prepare_weekly_driver_payouts(p_before timestamptz) returns integer
language plpgsql security definer set search_path=public as $$
declare v_driver uuid; v_ids uuid[]; v_total numeric; v_payout uuid; v_count integer:=0;
begin
 for v_driver in select distinct driver_id from driver_earnings where status='pending' and payout_id is null and created_at<p_before loop
  select array_agg(id),sum(amount) into v_ids,v_total from (select id,amount from driver_earnings where driver_id=v_driver and status='pending' and payout_id is null and created_at<p_before order by id for update skip locked) locked;
  if coalesce(v_total,0)>0 then
   insert into payouts(driver_id,amount,status) values(v_driver,v_total,'pending') returning id into v_payout;
   update driver_earnings set payout_id=v_payout where id=any(v_ids);
   v_count:=v_count+1;
  end if;
 end loop;
 return v_count;
end $$;
revoke all on function public.prepare_weekly_driver_payouts(timestamptz) from public,anon,authenticated;
grant execute on function public.prepare_weekly_driver_payouts(timestamptz) to service_role;
commit;
