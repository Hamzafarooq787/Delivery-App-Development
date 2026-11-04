alter table public.delivery_requests
 add column recipient_name text,
 add column recipient_phone text,
 add column collection_at timestamptz;
revoke insert(recipient_name,recipient_phone,collection_at),update(recipient_name,recipient_phone,collection_at) on public.delivery_requests from public,anon,authenticated;

-- Apply only to a paid parcel booking created by the verified checkout flow.
create function public.copy_paid_parcel_contact() returns trigger
language plpgsql security definer set search_path=public,pg_temp as $$
begin
 if new.status='paid' and old.status is distinct from 'paid'
  and new.purpose='booking' and new.payment_method='stripe' and new.delivery_id is not null
  and new.booking_draft->>'service_type'='delivery'
  and nullif(new.booking_draft->>'recipient_name','') is not null
  and new.booking_draft->>'recipient_phone' ~ '^\+44[1235789][0-9]{9}$' then
  update public.delivery_requests
  set recipient_name=left(new.booking_draft->>'recipient_name',100),
      recipient_phone=new.booking_draft->>'recipient_phone',
      collection_at=(new.booking_draft->>'collection_at')::timestamptz
  where id=new.delivery_id and customer_id=new.customer_id and service_type='delivery';
 end if;
 return new;
end $$;
revoke all on function public.copy_paid_parcel_contact() from public,anon,authenticated;
create trigger copy_paid_parcel_contact after update of status on public.payments
for each row execute function public.copy_paid_parcel_contact();
