-- Adds notification preference columns to driver_profiles.
-- Run once in the Supabase SQL editor.

alter table driver_profiles
  add column if not exists notifications_enabled boolean not null default true;

alter table driver_profiles
  add column if not exists delivery_alerts boolean not null default true;
