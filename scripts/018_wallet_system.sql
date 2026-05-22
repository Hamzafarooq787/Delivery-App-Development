-- =============================================
-- Wallet system: balances + transactions
-- =============================================

-- 1. Wallet balances (one row per customer)
create table if not exists wallet_balances (
  user_id   uuid primary key references auth.users(id) on delete cascade,
  balance   numeric not null default 0 check (balance >= -9999),
  updated_at timestamptz not null default now()
);

alter table wallet_balances enable row level security;
drop policy if exists "User sees own wallet" on wallet_balances;
create policy "User sees own wallet" on wallet_balances for select using (auth.uid() = user_id);
drop policy if exists "User updates own wallet" on wallet_balances;
create policy "User updates own wallet" on wallet_balances for update using (auth.uid() = user_id);
drop policy if exists "Service role wallet" on wallet_balances;
create policy "Service role wallet" on wallet_balances for all using (true) with check (true);

-- 2. Wallet transactions (audit log)
create table if not exists wallet_transactions (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('topup','cashback','cancellation_fee','deduction')),
  amount      numeric not null,
  description text,
  delivery_id uuid references delivery_requests(id) on delete set null,
  created_at  timestamptz not null default now()
);
create index if not exists wallet_tx_user_idx on wallet_transactions(user_id, created_at desc);

alter table wallet_transactions enable row level security;
drop policy if exists "User sees own transactions" on wallet_transactions;
create policy "User sees own transactions" on wallet_transactions for select using (auth.uid() = user_id);
drop policy if exists "Service role wallet_tx" on wallet_transactions;
create policy "Service role wallet_tx" on wallet_transactions for all using (true) with check (true);

-- 3. Add cancelled_by to delivery_requests
alter table delivery_requests add column if not exists cancelled_by text check (cancelled_by in ('customer','driver','admin'));

-- 4. Helper RPC for atomic balance increment
create or replace function increment_wallet_balance(p_user_id uuid, p_amount numeric)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into wallet_balances(user_id, balance, updated_at)
  values (p_user_id, p_amount, now())
  on conflict (user_id) do update
    set balance = wallet_balances.balance + p_amount,
        updated_at = now();
end;
$$;

-- 5. Enable Realtime on wallet_balances
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='wallet_balances') then
    alter publication supabase_realtime add table wallet_balances;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='wallet_transactions') then
    alter publication supabase_realtime add table wallet_transactions;
  end if;
end $$;

-- 6. Trigger: when driver cancels → cashback to customer wallet
create or replace function handle_driver_cancellation()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
declare
  cashback_amount numeric;
begin
  -- Only fire on UPDATE where status changed to 'cancelled' and cancelled_by = 'driver'
  if TG_OP = 'UPDATE'
    and new.status = 'cancelled'
    and new.cancelled_by = 'driver'
    and old.status != 'cancelled'
    and new.customer_id is not null
    and new.price is not null
    and new.price > 0
  then
    cashback_amount := new.price;

    -- Upsert wallet balance (add cashback)
    insert into wallet_balances(user_id, balance, updated_at)
    values (new.customer_id, cashback_amount, now())
    on conflict (user_id) do update
      set balance = wallet_balances.balance + cashback_amount,
          updated_at = now();

    -- Log the transaction
    insert into wallet_transactions(user_id, type, amount, description, delivery_id)
    values (
      new.customer_id,
      'cashback',
      cashback_amount,
      'Cashback: driver cancelled order ' || coalesce(new.tracking_number, new.id::text),
      new.id
    );

    -- Notify customer
    insert into notifications(user_id, title, body)
    values (
      new.customer_id,
      'Cashback Added to Wallet',
      '£' || cashback_amount::text || ' cashback added to your wallet — driver cancelled your order.'
    );
  end if;
  return new;
end;
$$;

drop trigger if exists on_driver_cancellation on delivery_requests;
create trigger on_driver_cancellation
  after update on delivery_requests
  for each row execute function handle_driver_cancellation();
