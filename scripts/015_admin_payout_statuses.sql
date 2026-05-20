-- Migration 015: extend payouts.status to support full admin lifecycle
-- Run once in Supabase SQL editor
-- Adds 'approved' and 'rejected' statuses to the payouts workflow.

-- If the column has an existing check constraint, drop and recreate it.
DO $$
BEGIN
  ALTER TABLE payouts DROP CONSTRAINT IF EXISTS payouts_status_check;
EXCEPTION WHEN others THEN NULL;
END $$;

ALTER TABLE payouts
  ADD CONSTRAINT payouts_status_check
  CHECK (status IN ('pending', 'approved', 'rejected', 'paid'));

-- Optional: add processed_at + processed_by columns for audit trail
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS processed_at  timestamptz;
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS processed_by  uuid REFERENCES auth.users(id);
ALTER TABLE payouts ADD COLUMN IF NOT EXISTS admin_note    text;
