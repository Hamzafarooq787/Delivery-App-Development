-- ============================================================
-- Create driver-documents storage bucket and RLS policies
-- Run this once in the Supabase SQL editor.
-- ============================================================

-- Create the storage bucket (public so file URLs work without auth)
insert into storage.buckets (id, name, public)
values ('driver-documents', 'driver-documents', true)
on conflict (id) do nothing;

-- Allow authenticated drivers to upload to their own folder
create policy "Driver can upload own documents"
  on storage.objects for insert
  to authenticated
  with check (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow authenticated drivers to update/replace their own files
create policy "Driver can update own documents"
  on storage.objects for update
  to authenticated
  using (
    bucket_id = 'driver-documents'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

-- Allow public read (so admin can view documents via URL)
create policy "Public can read driver documents"
  on storage.objects for select
  to public
  using (bucket_id = 'driver-documents');

-- ============================================================
-- driver_documents table: admin full access + driver own access
-- ============================================================

alter table driver_documents enable row level security;

drop policy if exists "Admin full access driver_documents" on driver_documents;
create policy "Admin full access driver_documents"
  on driver_documents for all
  using (
    exists (select 1 from users where id = auth.uid() and role = 'admin')
  );

drop policy if exists "Driver can view own documents" on driver_documents;
create policy "Driver can view own documents"
  on driver_documents for select
  using (auth.uid() = driver_id);

drop policy if exists "Driver can insert own documents" on driver_documents;
create policy "Driver can insert own documents"
  on driver_documents for insert
  with check (auth.uid() = driver_id);

drop policy if exists "Driver can delete own documents" on driver_documents;
create policy "Driver can delete own documents"
  on driver_documents for delete
  using (auth.uid() = driver_id);
