-- ============================================================
-- Push subscription table for Web Push API (VAPID)
-- Stores each browser's PushSubscription so the server can
-- send native OS notifications to drivers even when the app
-- is closed or in the background.
-- ============================================================

create table if not exists push_subscriptions (
  id          uuid        primary key default gen_random_uuid(),
  user_id     uuid        not null references auth.users(id) on delete cascade,
  role        text        not null check (role in ('driver', 'customer', 'admin')),
  endpoint    text        not null,           -- unique browser push endpoint URL
  p256dh      text        not null,           -- ECDH public key (base64url)
  auth        text        not null,           -- auth secret (base64url)
  user_agent  text,                           -- optional: browser identifier
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),

  -- One subscription per endpoint (endpoint is globally unique per browser/device)
  constraint push_subscriptions_endpoint_unique unique (endpoint)
);

-- Index for fast lookup by user
create index if not exists push_subscriptions_user_id_idx
  on push_subscriptions (user_id);

-- Index for batch sends to all drivers
create index if not exists push_subscriptions_role_idx
  on push_subscriptions (role);

-- RLS
alter table push_subscriptions enable row level security;

-- Users can manage their own subscriptions
create policy "Users can insert own push subscriptions"
  on push_subscriptions for insert
  with check (auth.uid() = user_id);

create policy "Users can select own push subscriptions"
  on push_subscriptions for select
  using (auth.uid() = user_id);

create policy "Users can delete own push subscriptions"
  on push_subscriptions for delete
  using (auth.uid() = user_id);

-- Service role can read all (needed by push send API route)
create policy "Service role can select all push subscriptions"
  on push_subscriptions for select
  using (true);

-- updated_at trigger
create or replace function touch_push_subscriptions_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create trigger push_subscriptions_updated_at
  before update on push_subscriptions
  for each row execute function touch_push_subscriptions_updated_at();
