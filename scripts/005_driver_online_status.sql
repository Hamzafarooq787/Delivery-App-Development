-- Add is_online column to driver_profiles if it doesn't exist
alter table driver_profiles
  add column if not exists is_online boolean not null default false;
