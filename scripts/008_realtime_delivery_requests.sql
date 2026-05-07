-- Enable Supabase Realtime on delivery_requests so drivers, admins,
-- and customers receive live postgres_changes events.

alter publication supabase_realtime add table delivery_requests;

-- Also enable on driver_profiles so online-status changes propagate.
alter publication supabase_realtime add table driver_profiles;
