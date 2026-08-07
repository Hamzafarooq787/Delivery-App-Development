-- 028_delivery_photo_proof.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Photo Proof — collection-time photos already exist (parcel_image_url,
-- scripts/012_parcel_photo.sql). This adds the matching drop-off photo,
-- captured by the driver and saved atomically with the OTP-verified
-- "delivered" transition (see verifyDeliveryOtpAndComplete()).
--
-- Run in the Supabase SQL editor.

alter table delivery_requests add column if not exists delivered_image_url text;
