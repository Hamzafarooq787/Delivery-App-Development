-- Fix storage RLS policies for driver-documents bucket
-- Run this in the Supabase SQL editor

-- Ensure the bucket exists
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', true)
on conflict (id) do nothing;

-- Drop old policies (clean slate)
drop policy if exists "Driver can upload own documents" on storage.objects;
drop policy if exists "Driver can update own documents" on storage.objects;
drop policy if exists "Public can read driver documents" on storage.objects;
drop policy if exists "Authenticated can read driver documents" on storage.objects;

-- Allow any authenticated user to insert into driver-documents bucket
create policy "Driver can upload own documents"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'driver-documents');

-- Allow any authenticated user to update files in driver-documents bucket
create policy "Driver can update own documents"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'driver-documents')
  with check (bucket_id = 'driver-documents');

-- Allow public read (so file URLs work without auth)
create policy "Public can read driver documents"
  on storage.objects for select
  to public
  using (bucket_id = 'driver-documents');

-- Allow authenticated users to delete their own files
create policy "Driver can delete own documents"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'driver-documents');
