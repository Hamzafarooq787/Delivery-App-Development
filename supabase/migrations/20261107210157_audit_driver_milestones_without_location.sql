-- Audit milestones atomically with the transition. A missing GPS fix is never a gate.
create function public.audit_driver_milestone_location() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
declare event_at timestamptz := clock_timestamp(); step text; steps text[] := array[]::text[];
begin
 if new.driver_id is null or new.driver_id is distinct from old.driver_id then return new; end if;
 if old.travel_started_at is null and new.travel_started_at is not null then steps:=array_append(steps,'travel'); end if;
 if old.arrived_at is null and new.arrived_at is not null then steps:=array_append(steps,'arrived'); end if;
 if old.purchased_at is null and new.purchased_at is not null then steps:=array_append(steps,'purchased'); end if;
 if old.status is distinct from 'delivered' and new.status='delivered' then steps:=array_append(steps,'delivered'); end if;
 if cardinality(steps)=0 then return new; end if;

 if exists(select 1 from public.driver_locations l
   where l.driver_id=new.driver_id and l.delivery_id=new.id
   and l.updated_at >= (event_at - interval '45 seconds') at time zone 'UTC'
   and l.updated_at <= (event_at + interval '5 seconds') at time zone 'UTC') then return new; end if;

 foreach step in array steps loop
  insert into public.admin_audit_log(actor_id,event,entity,details,created_at)
  values(new.driver_id,'driver_milestone_without_location',new.id::text,
    jsonb_build_object('stage',step,'location','unavailable','accepted_at',new.accepted_at),event_at);
 end loop;
 return new;
end $$;
revoke all on function public.audit_driver_milestone_location() from public,anon,authenticated;
create trigger audit_driver_milestone_location after update on public.delivery_requests
for each row when (new.driver_id is not null and (
  old.travel_started_at is distinct from new.travel_started_at
  or old.arrived_at is distinct from new.arrived_at or old.purchased_at is distinct from new.purchased_at
  or (old.status is distinct from new.status and new.status='delivered')
))
execute function public.audit_driver_milestone_location();
