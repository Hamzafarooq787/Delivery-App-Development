-- Add parcel photo URL column to delivery_requests
alter table delivery_requests
  add column if not exists parcel_image_url text;
