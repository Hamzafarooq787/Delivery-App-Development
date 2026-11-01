-- Shared, service-only budgets for authenticated paid integrations.
create or replace function public.claim_integration_request(p_user uuid,p_service text) returns boolean language plpgsql security definer set search_path=public,pg_temp as $$
declare buckets jsonb; entry jsonb; minute bigint:=floor(extract(epoch from now())/60); total int; hits int; per_user int; overall int;
begin
 if p_service is null or p_service not in ('maps','chat') or not exists(select 1 from users where id=p_user and account_status='active') then return false;end if;
 select geocode_rate_buckets into buckets from surge_pricing_settings where id=true for update;
 if not found then return false;end if;
 entry:=coalesce(buckets->('integration.'||p_service),'{}'::jsonb);
 if (entry->>'minute')::bigint is distinct from minute then entry:=jsonb_build_object('minute',minute,'total',0,'clients','{}'::jsonb);end if;
 total:=coalesce((entry->>'total')::int,0);hits:=coalesce((entry->'clients'->>p_user::text)::int,0);
 per_user:=case when p_service='chat' then 6 else 120 end;overall:=per_user*10;
 if hits>=per_user or total>=overall then return false;end if;
 entry:=jsonb_set(jsonb_set(entry,'{total}',to_jsonb(total+1)),array['clients',p_user::text],to_jsonb(hits+1));
 update surge_pricing_settings set geocode_rate_buckets=jsonb_set(coalesce(buckets,'{}'::jsonb),array['integration.'||p_service],entry) where id=true;
 return true;
end;$$;
revoke all on function public.claim_integration_request(uuid,text) from public,anon,authenticated;
grant execute on function public.claim_integration_request(uuid,text) to service_role;

-- Aggregate inside PostgreSQL instead of truncating at the REST row limit.
create or replace function public.approved_rating_summary(p_user uuid) returns jsonb language sql set search_path=public,pg_temp as $$
 select jsonb_build_object('average',round(avg(score),2),'count',count(*)) from ratings where rated_id=p_user and status='approved';
$$;
revoke all on function public.approved_rating_summary(uuid) from public,anon,authenticated;
grant execute on function public.approved_rating_summary(uuid) to service_role;

create or replace function public.submit_delivery_rating(p_actor uuid,p_delivery uuid,p_score integer,p_comment text) returns void language plpgsql set search_path=public,pg_temp as $$
declare job delivery_requests%rowtype;target uuid;kind text;
begin
 if p_score is null or p_score not between 1 and 5 or length(coalesce(p_comment,''))>2000 then raise exception 'invalid_rating';end if;
 perform 1 from users where id=p_actor and account_status='active' for update;
 if not found then raise exception 'account_unavailable';end if;
 select * into job from delivery_requests where id=p_delivery for share;
 if not found or job.status is distinct from 'delivered' then raise exception 'delivery_not_completed';end if;
 if job.customer_id=p_actor then target:=job.driver_id;kind:='customer';elsif job.driver_id=p_actor then target:=job.customer_id;kind:='driver';else raise exception 'not_participant';end if;
 if target is null or target=p_actor then raise exception 'invalid_participant';end if;
 insert into ratings(delivery_id,rater_id,rated_id,rater_role,score,comment,status) values(p_delivery,p_actor,target,kind,p_score,nullif(trim(p_comment),''),'pending');
end;$$;
revoke all on function public.submit_delivery_rating(uuid,uuid,integer,text) from public,anon,authenticated;
grant execute on function public.submit_delivery_rating(uuid,uuid,integer,text) to service_role;
