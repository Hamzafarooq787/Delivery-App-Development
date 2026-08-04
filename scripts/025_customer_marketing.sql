-- 025_customer_marketing.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Customer Database & Marketing.
--
-- Marketing consent: UK PECR requires explicit OPT-IN for marketing comms
-- (not opt-out-by-default), so both flags default to false. Transactional
-- messages (order updates, receipts) are NOT gated by these — this consent
-- only covers promotional offers, discount codes, service updates sent as
-- marketing, and re-engagement reminders.
--
-- Run in the Supabase SQL editor.

-- ═══════════════════════════════════════════════════════════════════════════
-- Marketing consent on users
-- ═══════════════════════════════════════════════════════════════════════════
alter table users
  add column if not exists marketing_email_opt_in boolean not null default false,
  add column if not exists marketing_push_opt_in boolean not null default false,
  add column if not exists marketing_consent_updated_at timestamptz;

-- Existing "Users can update own profile" / "Users can view own profile"
-- policies on `users` (scripts/002_rls_and_triggers.sql) already cover these
-- new columns — no additional RLS needed for customer-side read/write.

-- ═══════════════════════════════════════════════════════════════════════════
-- Marketing campaigns (manual admin broadcasts + automatic re-engagement runs)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists marketing_campaigns (
  id uuid primary key default gen_random_uuid(),
  type text not null default 'manual' check (type in ('manual', 'auto_reengagement')),
  title text not null,
  subject text not null,
  message text not null,
  channel text not null check (channel in ('push', 'email', 'both')),
  segment text not null check (segment in ('all', 'inactive')),
  inactive_days int,
  promo_code_id uuid references promo_codes(id) on delete set null,
  status text not null default 'sending' check (status in ('sending', 'sent', 'failed')),
  recipient_count int not null default 0,
  sent_count int not null default 0,
  failed_count int not null default 0,
  skipped_count int not null default 0,
  created_by uuid references users(id),
  created_at timestamptz not null default now(),
  completed_at timestamptz
);

create index if not exists marketing_campaigns_created_at_idx on marketing_campaigns (created_at desc);

alter table marketing_campaigns enable row level security;

drop policy if exists "Admin full access marketing_campaigns" on marketing_campaigns;
create policy "Admin full access marketing_campaigns"
  on marketing_campaigns for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- Per-recipient send log — audit trail + dedupe source for campaign history.
create table if not exists marketing_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references marketing_campaigns(id) on delete cascade,
  user_id uuid not null references users(id) on delete cascade,
  channel text not null check (channel in ('push', 'email')),
  status text not null check (status in ('sent', 'failed', 'skipped_opted_out', 'skipped_no_contact')),
  error text,
  sent_at timestamptz not null default now()
);

create index if not exists marketing_campaign_recipients_campaign_idx on marketing_campaign_recipients (campaign_id);
create index if not exists marketing_campaign_recipients_user_idx on marketing_campaign_recipients (user_id);

alter table marketing_campaign_recipients enable row level security;

drop policy if exists "Admin full access marketing_campaign_recipients" on marketing_campaign_recipients;
create policy "Admin full access marketing_campaign_recipients"
  on marketing_campaign_recipients for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- ═══════════════════════════════════════════════════════════════════════════
-- Automatic re-engagement reminders (single-row config + per-user send log)
-- ═══════════════════════════════════════════════════════════════════════════
create table if not exists reengagement_settings (
  id boolean primary key default true check (id = true), -- enforces a single row
  enabled boolean not null default false,
  inactive_days int not null default 30 check (inactive_days > 0),
  channel text not null default 'both' check (channel in ('push', 'email', 'both')),
  subject text not null default 'We miss you at Go Drop!',
  message text not null default 'It''s been a while — come back and get your next delivery moving with Go Drop.',
  promo_code_id uuid references promo_codes(id) on delete set null,
  updated_at timestamptz not null default now(),
  updated_by uuid references users(id)
);

insert into reengagement_settings (id) values (true) on conflict (id) do nothing;

alter table reengagement_settings enable row level security;

drop policy if exists "Admin full access reengagement_settings" on reengagement_settings;
create policy "Admin full access reengagement_settings"
  on reengagement_settings for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- One row per user: when they last received an automatic re-engagement
-- reminder, so the cron doesn't re-send every single day while they stay
-- inactive — only once per inactivity window.
create table if not exists reengagement_sends (
  user_id uuid primary key references users(id) on delete cascade,
  last_sent_at timestamptz not null default now()
);

alter table reengagement_sends enable row level security;

drop policy if exists "Admin full access reengagement_sends" on reengagement_sends;
create policy "Admin full access reengagement_sends"
  on reengagement_sends for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));
