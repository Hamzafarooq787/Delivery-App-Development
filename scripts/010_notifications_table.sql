-- ============================================================
-- Dedicated notifications table with trigger-based delivery
-- Much more reliable than postgres_changes on delivery_requests
-- ============================================================

-- 1. Create notifications table
create table if not exists notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null,
  body text not null,
  read boolean not null default false,
  created_at timestamptz not null default now()
);

create index if not exists notifications_user_id_idx on notifications(user_id, created_at desc);

-- 2. RLS
alter table notifications enable row level security;

drop policy if exists "Users can view own notifications" on notifications;
create policy "Users can view own notifications"
  on notifications for select
  using (auth.uid() = user_id);

drop policy if exists "Users can update own notifications" on notifications;
create policy "Users can update own notifications"
  on notifications for update
  using (auth.uid() = user_id);

drop policy if exists "Users can delete own notifications" on notifications;
create policy "Users can delete own notifications"
  on notifications for delete
  using (auth.uid() = user_id);

-- Service role can insert (used by the trigger function)
drop policy if exists "Service role can insert notifications" on notifications;
create policy "Service role can insert notifications"
  on notifications for insert
  with check (true);

-- 3. Enable Realtime on notifications table
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'notifications'
  ) then
    alter publication supabase_realtime add table notifications;
  end if;
end $$;

-- 4. Trigger function that fires on delivery_requests INSERT/UPDATE
create or replace function notify_delivery_change()
returns trigger
language plpgsql
security definer
set search_path = public
set row_security = off
as $$
declare
  tn text;
  drv record;
  admin_rec record;
begin
  -- Build a short tracking number label
  tn := coalesce('#' || new.tracking_number, '#' || upper(substring(new.id::text, 1, 8)));

  -- ── INSERT: new delivery requested ──────────────────────────────────────────
  if TG_OP = 'INSERT' then

    -- Notify all admins
    for admin_rec in
      select id from users where role = 'admin'
    loop
      insert into notifications(user_id, title, body)
      values (
        admin_rec.id,
        'New Shipment Request',
        tn || ' — ' ||
          split_part(new.pickup_address, ',', 1) || ' → ' ||
          split_part(new.delivery_address, ',', 1)
      );
    end loop;

    -- Notify all approved drivers
    for drv in
      select dp.id from driver_profiles dp
      where dp.status = 'approved'
    loop
      insert into notifications(user_id, title, body)
      values (
        drv.id,
        'New Job Available',
        tn || ' — ' ||
          split_part(new.pickup_address, ',', 1) || ' → ' ||
          split_part(new.delivery_address, ',', 1)
      );
    end loop;

  -- ── UPDATE: status changed ───────────────────────────────────────────────────
  elsif TG_OP = 'UPDATE' and old.status is distinct from new.status then

    -- Notify customer of status updates
    if new.status = 'accepted' then
      insert into notifications(user_id, title, body)
      values (new.customer_id, 'Driver On the Way',
        'Your delivery ' || tn || ' has been accepted by a driver.');

    elsif new.status in ('collected', 'picked_up') then
      insert into notifications(user_id, title, body)
      values (new.customer_id, 'Package Picked Up',
        'Driver has collected your package for ' || tn || '.');

    elsif new.status = 'in_transit' then
      insert into notifications(user_id, title, body)
      values (new.customer_id, 'In Transit',
        'Your delivery ' || tn || ' is on its way.');

    elsif new.status = 'delivered' then
      insert into notifications(user_id, title, body)
      values (new.customer_id, 'Delivered!',
        'Your delivery ' || tn || ' has been completed.');
    end if;

  end if;

  return new;
end;
$$;

-- 5. Attach trigger to delivery_requests
drop trigger if exists on_delivery_change on delivery_requests;
create trigger on_delivery_change
  after insert or update on delivery_requests
  for each row
  execute function notify_delivery_change();
