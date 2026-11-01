-- Production settings use a boolean singleton ID. Preserve unrelated private rate buckets.
create or replace function public.claim_public_geocode(p_key text) returns boolean
language plpgsql security definer set search_path=public,pg_temp as $$
declare buckets jsonb; minute bigint:=floor(extract(epoch from now())/60); entry jsonb; total integer; hits integer;
begin
 if p_key is null or p_key !~ '^[a-f0-9]{64}$' then return false; end if;
 select geocode_rate_buckets into buckets from surge_pricing_settings where id=true for update;
 if not found then return false; end if;
 if (buckets->>'minute')::bigint is distinct from minute then buckets:=(coalesce(buckets,'{}'::jsonb)-array['minute','total','clients'])||jsonb_build_object('minute',minute,'total',0,'clients','{}'::jsonb); end if;
 total:=coalesce((buckets->>'total')::int,0);hits:=coalesce((buckets->'clients'->>p_key)::int,0);
 if total>=60 or hits>=10 then return false; end if;
 buckets:=jsonb_set(buckets,'{total}',to_jsonb(total+1));
 buckets:=jsonb_set(buckets,array['clients',p_key],to_jsonb(hits+1));
 update surge_pricing_settings set geocode_rate_buckets=buckets where id=true;
 return true;
end $$;
revoke all on function public.claim_public_geocode(text) from public,anon,authenticated;
grant execute on function public.claim_public_geocode(text) to service_role;
