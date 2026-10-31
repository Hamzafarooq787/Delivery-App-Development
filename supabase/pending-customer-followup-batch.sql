-- Customer follow-up: display state only; no funds are moved.
create or replace function public.customer_payment_records(p_customer uuid,p_page integer default 1,p_size integer default 10,p_refunds boolean default false)
returns jsonb language sql stable security invoker set search_path=public,pg_temp as $$
 with records as (
 select p.id,p.delivery_id,p.status,p.created_at,p.payment_method,
 case when p.payment_method='wallet' then coalesce((select jsonb_agg(jsonb_build_object('key',w.id,'amount',w.amount,'state','succeeded')) from public.wallet_transactions w where w.delivery_id=d.id and w.user_id=p_customer and w.type='cashback' and w.amount>0),'[]'::jsonb) else coalesce(p.refund_jobs,'[]'::jsonb) end refund_jobs,
 d.tracking_number tracking,case when d.service_type='buy_for_me' then 'Buy for Me' else 'Collect & Deliver' end service,
 case when p.payment_method='wallet' and d.service_type='buy_for_me' then d.price+coalesce(d.max_spend_approved,0) else p.amount end amount,
 case when d.service_type='buy_for_me' then coalesce(d.max_spend_approved,0) else 0 end "shoppingFunds",d.price "serviceFees",
 case when d.shopping_hold_settled_at is not null then d.actual_items_total end "actualShopping",
 case when d.shopping_hold_settled_at is not null then greatest(0,coalesce(d.max_spend_approved,0)-d.actual_items_total) end "unusedShopping"
 from public.payments p join public.delivery_requests d on d.id=p.delivery_id
 where d.customer_id=p_customer
 ), calculated as (
 select r.*,case when jsonb_array_length(refund_jobs)>0 then coalesce((select sum((j->>'amount')::numeric) from jsonb_array_elements(refund_jobs) j where j->>'state'='succeeded'),0)
 when status='refunded' then amount else 0 end returned from records r
 ), filtered as (select * from calculated where not p_refunds or jsonb_array_length(refund_jobs)>0 or status in ('refunded','partially_refunded')),
 page as (select *,greatest(0,amount-returned) "retainedTotal" from filtered order by created_at desc nulls last,id desc limit greatest(1,least(coalesce(p_size,10),50)) offset (greatest(1,coalesce(p_page,1))-1)*greatest(1,least(coalesce(p_size,10),50)))
 select jsonb_build_object('rows',coalesce((select jsonb_agg(to_jsonb(page)||jsonb_build_object('payment_status',status,'status',case when returned>0 and round(returned*100)>=round(amount*100) then 'refunded' when returned>0 then 'partially_refunded' when exists(select 1 from jsonb_array_elements(refund_jobs) j where j->>'state' in ('pending','requires_action')) then 'refund_pending' else status end)) from page),'[]'::jsonb),'totalCount',(select count(*) from filtered),
 'paidMonth',(select coalesce(sum(amount),0) from calculated where status in ('paid','released','refunded','partially_refunded') and created_at >= (date_trunc('month',now() at time zone 'Europe/London') at time zone 'Europe/London')),
 'refunds',(select coalesce(sum(returned),0) from calculated));
$$;
revoke all on function public.customer_payment_records(uuid,integer,integer,boolean) from public,anon,authenticated;
grant execute on function public.customer_payment_records(uuid,integer,integer,boolean) to service_role;


-- Durable inbox notification is committed with the message in the same transaction.
alter table public.notifications add column if not exists action_url text;
create or replace function public.send_customer_order_message(p_id uuid,p_actor uuid,p_key uuid,p_body text)
returns jsonb language plpgsql security invoker set search_path=public,pg_temp as $$
declare o public.delivery_requests%rowtype; existing jsonb; recipient uuid; target text;
begin
 select * into o from public.delivery_requests where id=p_id for update;
 if not found or p_actor is null or p_key is null or p_body is null or char_length(trim(p_body)) not between 1 and 4000
 or not (p_actor=o.customer_id or p_actor=o.driver_id) or o.driver_id is null or o.status not in ('accepted','collected','in_transit') then raise exception 'Conversation unavailable'; end if;
 select m into existing from jsonb_array_elements(o.order_messages) m where m->>'id'=p_key::text;
 if existing is not null then
  if existing->>'sender_id'<>p_actor::text or existing->>'body'<>trim(p_body) then raise exception 'Message reference changed'; end if;
  return jsonb_build_object('created',false);
 end if;
 perform public.append_customer_thread('order',p_id,p_actor,p_key,p_body);
 recipient:=case when p_actor=o.customer_id then o.driver_id else o.customer_id end;
 target:=case when recipient=o.customer_id then '/dashboard/customer/tracking?id='||p_id::text else '/dashboard/driver/jobs/'||p_id::text end;
 insert into public.notifications(id,user_id,title,body,action_url) values(p_key,recipient,'New delivery message','A new message is waiting for order '||coalesce(o.tracking_number,left(p_id::text,8))||'.',target);
 return jsonb_build_object('created',true,'recipient',recipient,'url',target);
end $$;
revoke all on function public.send_customer_order_message(uuid,uuid,uuid,text) from public,anon,authenticated;
grant execute on function public.send_customer_order_message(uuid,uuid,uuid,text) to service_role;
