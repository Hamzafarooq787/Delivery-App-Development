-- Migration 016: Auto-generate tracking numbers for delivery_requests
-- Ensures every delivery always gets a unique TRK-... tracking number,
-- even if application code forgets to set one.

-- Function: fires BEFORE INSERT, sets tracking_number if null/empty
create or replace function generate_tracking_number()
returns trigger
language plpgsql
as $$
begin
  if new.tracking_number is null or new.tracking_number = '' then
    -- Format: TRK-<epoch_ms>-<6 random alphanumeric chars>
    new.tracking_number := 'TRK-' ||
      extract(epoch from now())::bigint::text ||
      '-' ||
      upper(substring(md5(random()::text) from 1 for 6));
  end if;
  return new;
end;
$$;

-- Attach trigger to delivery_requests
drop trigger if exists trg_tracking_number on delivery_requests;
create trigger trg_tracking_number
  before insert on delivery_requests
  for each row
  execute function generate_tracking_number();

-- Backfill: fix all existing rows that have a null tracking_number
update delivery_requests
set tracking_number = 'TRK-' ||
  extract(epoch from created_at)::bigint::text ||
  '-' ||
  upper(substring(md5(id::text) from 1 for 6))
where tracking_number is null or tracking_number = '';
