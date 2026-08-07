-- 027_delivery_otp.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- OTP / Delivery Verification — a 4-digit code is generated for every
-- delivery. The customer reads it out to the driver at handoff; the driver
-- must enter it correctly (via a server action) to mark the delivery as
-- delivered.
--
-- Stored in its OWN table, not a column on delivery_requests, specifically
-- so the driver never has row-level SELECT access to it. Every driver-facing
-- delivery query in this app is scoped by RLS to delivery_requests — putting
-- the code there would risk it leaking through a future `select("*")`. No
-- policy below grants drivers any access to this table; that omission is
-- intentional and load-bearing. The driver's server action verifies the
-- code server-side and only ever returns success/failure, never the code.
--
-- Run in the Supabase SQL editor.

create table if not exists delivery_otps (
  delivery_id uuid primary key references delivery_requests(id) on delete cascade,
  otp text not null,
  attempts int not null default 0,
  verified_at timestamptz,
  created_at timestamptz not null default now()
);

alter table delivery_requests add column if not exists delivered_at timestamptz;

alter table delivery_otps enable row level security;

drop policy if exists "Admin full access delivery_otps" on delivery_otps;
create policy "Admin full access delivery_otps"
  on delivery_otps for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Customer can view own delivery otp" on delivery_otps;
create policy "Customer can view own delivery otp"
  on delivery_otps for select
  using (exists (
    select 1 from delivery_requests dr
    where dr.id = delivery_otps.delivery_id and dr.customer_id = auth.uid()
  ));

-- Auto-generate a 4-digit code the moment a delivery is created, regardless
-- of which code path inserts the row — SECURITY DEFINER so it runs even
-- though delivery_otps has no INSERT policy for anyone but admins.
create or replace function generate_delivery_otp() returns trigger as $$
begin
  insert into delivery_otps (delivery_id, otp)
  values (new.id, lpad(floor(random() * 10000)::text, 4, '0'));
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_delivery_request_created on delivery_requests;
create trigger on_delivery_request_created
  after insert on delivery_requests
  for each row execute procedure generate_delivery_otp();
