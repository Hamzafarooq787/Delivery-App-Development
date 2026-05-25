-- ─────────────────────────────────────────────────────────────────────────────
-- 002_notification_tokens.sql
-- FCM push notification token storage for Kinetic Void
--
-- Run this SQL in your Supabase project → SQL Editor → New Query
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Table ──────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_notification_tokens (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fcm_token   TEXT        NOT NULL,
  device_type TEXT        NOT NULL DEFAULT 'web',   -- 'web' | 'mobile' | 'desktop'
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  -- Prevent duplicate (user, token) pairs — one row per device per user.
  -- An upsert on this constraint refreshes updated_at without creating duplicates.
  CONSTRAINT user_notification_tokens_user_token_unique
    UNIQUE (user_id, fcm_token)
);

COMMENT ON TABLE public.user_notification_tokens IS
  'Stores FCM push notification tokens per user device. '
  'Multiple rows per user are allowed (one per device).';

COMMENT ON COLUMN public.user_notification_tokens.fcm_token IS
  'Firebase Cloud Messaging registration token. Refreshed automatically by the client SDK.';

COMMENT ON COLUMN public.user_notification_tokens.device_type IS
  'Source device category: web, mobile, or desktop.';

-- ── 2. Index ──────────────────────────────────────────────────────────────────
-- Speeds up getUserFCMTokens() which filters by user_id on every send
CREATE INDEX IF NOT EXISTS idx_user_notification_tokens_user_id
  ON public.user_notification_tokens (user_id);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────
ALTER TABLE public.user_notification_tokens ENABLE ROW LEVEL SECURITY;

-- Users can only read and manage their own tokens
DROP POLICY IF EXISTS "users_manage_own_notification_tokens" ON public.user_notification_tokens;
CREATE POLICY "users_manage_own_notification_tokens"
  ON public.user_notification_tokens
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Auto-update trigger ────────────────────────────────────────────────────
-- Keep updated_at current whenever a row is upserted
CREATE OR REPLACE FUNCTION update_notification_token_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_update_notification_token_updated_at
  ON public.user_notification_tokens;

CREATE TRIGGER trg_update_notification_token_updated_at
  BEFORE UPDATE ON public.user_notification_tokens
  FOR EACH ROW
  EXECUTE FUNCTION update_notification_token_updated_at();

-- ── 5. Verify ────────────────────────────────────────────────────────────────
-- After running, you should see the table in Table Editor → user_notification_tokens
SELECT
  'user_notification_tokens table created successfully' AS status,
  COUNT(*) AS existing_rows
FROM public.user_notification_tokens;
