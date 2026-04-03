-- ============================================================
-- STEP 1: AUTO CREATE USER PROFILE ON SIGN UP
-- ============================================================

create or replace function handle_new_user()
returns trigger as $$
begin
  insert into public.users (id, role)
  values (new.id, 'customer');
  return new;
end;
$$ language plpgsql security definer set search_path = public;

drop trigger if exists on_auth_user_created on auth.users;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure handle_new_user();

-- ============================================================
-- STEP 2: ENABLE RLS ON ALL TABLES
-- ============================================================

alter table users enable row level security;
alter table customer_profiles enable row level security;
alter table driver_profiles enable row level security;
alter table driver_documents enable row level security;
alter table addresses enable row level security;
alter table delivery_requests enable row level security;
alter table delivery_status_logs enable row level security;
alter table proof_uploads enable row level security;
alter table payments enable row level security;
alter table driver_earnings enable row level security;
alter table disputes enable row level security;
alter table support_tickets enable row level security;
alter table payment_methods enable row level security;
alter table payouts enable row level security;

-- ============================================================
-- STEP 3: USERS TABLE POLICIES
-- ============================================================

drop policy if exists "Users can view own profile" on users;
create policy "Users can view own profile"
  on users for select
  using (auth.uid() = id);

drop policy if exists "Users can update own profile" on users;
create policy "Users can update own profile"
  on users for update
  using (auth.uid() = id);

-- ============================================================
-- STEP 4: DELIVERY REQUESTS POLICIES
-- ============================================================

drop policy if exists "Customer can view own deliveries" on delivery_requests;
create policy "Customer can view own deliveries"
  on delivery_requests for select
  using (auth.uid() = customer_id);

drop policy if exists "Driver can view assigned deliveries" on delivery_requests;
create policy "Driver can view assigned deliveries"
  on delivery_requests for select
  using (auth.uid() = driver_id);

drop policy if exists "Customer can create delivery" on delivery_requests;
create policy "Customer can create delivery"
  on delivery_requests for insert
  with check (auth.uid() = customer_id);

-- ============================================================
-- STEP 5: DRIVER PROFILES POLICIES
-- ============================================================

drop policy if exists "Driver can view own profile" on driver_profiles;
create policy "Driver can view own profile"
  on driver_profiles for select
  using (auth.uid() = id);

-- ============================================================
-- STEP 6: ADMIN FULL ACCESS POLICIES
-- ============================================================

drop policy if exists "Admin full access users" on users;
create policy "Admin full access users"
  on users for all
  using (
    exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    )
  );

drop policy if exists "Admin full access deliveries" on delivery_requests;
create policy "Admin full access deliveries"
  on delivery_requests for all
  using (
    exists (
      select 1 from users where id = auth.uid() and role = 'admin'
    )
  );
