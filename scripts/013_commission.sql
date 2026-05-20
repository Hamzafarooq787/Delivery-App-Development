-- Commission system: 75% driver / 25% platform
-- Add commission_amount column to driver_earnings to track the platform's 25% cut

alter table driver_earnings
  add column if not exists commission_amount numeric not null default 0;

-- Helpful comment for future reference
comment on column driver_earnings.amount           is 'Driver payout: 75% of delivery price';
comment on column driver_earnings.commission_amount is 'Platform commission: 25% of delivery price';
