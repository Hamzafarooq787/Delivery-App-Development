create role anon;create role authenticated;create role service_role bypassrls;create schema auth;
create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
create table public.addresses (id uuid default gen_random_uuid() not null, user_id uuid, address text, lat numeric, lng numeric, created_at timestamp without time zone default now());
create table public.busy_period_rules (id uuid default gen_random_uuid() not null, label text not null, day_of_week integer, start_time time without time zone not null, end_time time without time zone not null, multiplier numeric not null, active boolean default true not null, created_at timestamp with time zone default now() not null);
create table public.customer_profiles (id uuid not null, default_address text, created_at timestamp without time zone default now());
create table public.delivery_requests (id uuid default gen_random_uuid() not null, tracking_number text, customer_id uuid, driver_id uuid, pickup_address text, pickup_lat numeric, pickup_lng numeric, delivery_address text, delivery_lat numeric, delivery_lng numeric, item_description text, item_value numeric, price numeric, status text default 'requested'::text, is_safe_confirmed boolean default false, created_at timestamp without time zone default now(), parcel_image_url text, cancelled_by text, package_size text, item_photo_urls text[], base_price numeric, surge_multiplier numeric default 1 not null, discount_amount numeric default 0 not null, promo_code text, delivered_at timestamp with time zone, delivered_image_url text, service_type text default 'delivery'::text not null, shop_name text, shop_address text, shop_lat numeric, shop_lng numeric, shop_instructions text, bfm_stage text, estimated_items_total numeric, actual_items_total numeric, receipt_url text, purchase_confirmed_at timestamp with time zone, max_spend_approved numeric, service_fee numeric, shopping_request_key uuid, shopping_hold_settled_at timestamp with time zone, payment_method text default 'wallet'::text, driver_earning_quote numeric, distance_miles numeric, duration_min numeric, shopping_started_at timestamp with time zone, company_card_reference text, company_card_verified_at timestamp with time zone, shopping_problem text, shopping_limits jsonb, pickup_instructions text, delivery_instructions text, purchase_authorized_total numeric, purchase_authorized_at timestamp with time zone, shopping_timeline jsonb default '[]'::jsonb not null, order_messages jsonb default '[]'::jsonb not null, collection_wait jsonb);
create table public.delivery_status_logs (id uuid default gen_random_uuid() not null, delivery_id uuid, status text, updated_by uuid, created_at timestamp without time zone default now());
create table public.disputes (id uuid default gen_random_uuid() not null, delivery_id uuid, raised_by uuid, issue text, status text default 'open'::text, created_at timestamp without time zone default now());
create table public.driver_documents (id uuid default gen_random_uuid() not null, driver_id uuid, document_type text, file_url text, created_at timestamp without time zone default now(), expires_on date);
create table public.driver_earnings (id uuid default gen_random_uuid() not null, driver_id uuid, delivery_id uuid, amount numeric, status text default 'pending'::text, created_at timestamp without time zone default now(), commission_amount numeric default 0 not null, payout_id uuid);
create table public.driver_locations (driver_id uuid not null, delivery_id uuid, lat numeric not null, lng numeric not null, heading numeric, speed numeric, accuracy numeric, updated_at timestamp without time zone default now() not null);
create table public.driver_profiles (id uuid not null, status text default 'pending'::text, vehicle_type text, vehicle_number text, insurance_details text, created_at timestamp without time zone default now(), is_online boolean default false not null, notifications_enabled boolean default true not null, delivery_alerts boolean default true not null, stripe_connect_account_id text, stripe_connect_started_at timestamp with time zone, verification_submitted_at timestamp with time zone);
create table public.driver_vehicles (id uuid default gen_random_uuid() not null, driver_id uuid not null, vehicle_type text not null, make text, model text, colour text, registration_number text, driving_licence_details text, insurance_details text, created_at timestamp with time zone default now() not null, updated_at timestamp with time zone default now() not null);
create table public.notifications (id uuid default gen_random_uuid() not null, user_id uuid not null, title text not null, body text not null, read boolean default false not null, created_at timestamp with time zone default now() not null, action_url text);
create table public.payments (id uuid default gen_random_uuid() not null, delivery_id uuid, amount numeric, status text default 'pending'::text, stripe_payment_intent text, created_at timestamp without time zone default now(), stripe_session_id text, paid_at timestamp with time zone, customer_id uuid, request_key uuid, booking_draft jsonb, payment_method text default 'wallet'::text, refund_jobs jsonb default '[]'::jsonb not null, processing_fee numeric, refund_checked_at timestamp with time zone);
create table public.payouts (id uuid default gen_random_uuid() not null, driver_id uuid, amount numeric, status text default 'pending'::text, created_at timestamp without time zone default now(), processed_at timestamp with time zone, processed_by uuid, admin_note text, payment_reference text, earning_ids uuid[], provider jsonb);
create table public.ratings (id uuid default gen_random_uuid() not null, delivery_id uuid not null, rater_id uuid not null, rated_id uuid not null, rater_role text not null, score integer not null, comment text, status text default 'pending'::text not null, moderated_at timestamp with time zone, moderated_by uuid, created_at timestamp with time zone default now() not null);
create table public.shopping_items (id uuid default gen_random_uuid() not null, delivery_id uuid not null, name text not null, quantity integer default 1 not null, estimated_price numeric, actual_price numeric, brand_size_variant text, notes text, photo_url text, substitution_preference text default 'contact_me'::text, status text default 'pending'::text not null, created_at timestamp with time zone default now(), confirmed_unit_price numeric);
create table public.shopping_substitutions (id uuid default gen_random_uuid() not null, shopping_item_id uuid not null, delivery_id uuid not null, driver_id uuid not null, suggested_name text not null, suggested_price numeric, driver_notes text, photo_url text, customer_approved boolean, customer_responded_at timestamp with time zone, created_at timestamp with time zone default now());
create table public.support_tickets (id uuid default gen_random_uuid() not null, user_id uuid, subject text, message text, status text default 'open'::text, created_at timestamp without time zone default now(), replies jsonb default '[]'::jsonb not null);
create table public.surge_pricing_settings (id boolean default true not null, master_enabled boolean default false not null, demand_enabled boolean default true not null, demand_threshold_ratio numeric default 1.5 not null, demand_multiplier numeric default 1.3 not null, traffic_enabled boolean default true not null, traffic_threshold_ratio numeric default 1.4 not null, traffic_multiplier numeric default 1.25 not null, max_total_multiplier numeric default 2.0 not null, updated_at timestamp with time zone default now() not null, booking_pricing jsonb, booking_pricing_history jsonb default '[]'::jsonb not null, platform_settings jsonb default '{"name": "GoDrop", "email": "", "phone": ""}'::jsonb not null, geocode_rate_buckets jsonb default '{}'::jsonb not null, notification_settings jsonb default '{}'::jsonb not null, operations_history jsonb default '[]'::jsonb not null, automatic_payouts boolean default false not null, payout_worker_token uuid, payout_worker_until timestamp with time zone);
create table public.users (id uuid not null, role text default 'customer'::text, full_name text, phone text, created_at timestamp without time zone default now(), email text, marketing_email_opt_in boolean default false not null, marketing_push_opt_in boolean default false not null, marketing_consent_updated_at timestamp with time zone, service_push_enabled boolean default true not null, order_photo_leases jsonb default '{}'::jsonb not null);
create table public.wallet_balances (user_id uuid not null, balance numeric default 0 not null, updated_at timestamp with time zone default now() not null);
create table public.wallet_transactions (id uuid default gen_random_uuid() not null, user_id uuid not null, type text not null, amount numeric not null, description text, delivery_id uuid, created_at timestamp with time zone default now() not null, stripe_session_id text, refund_request_key uuid);
alter table public.addresses add primary key(id);
alter table public.busy_period_rules add primary key(id);
alter table public.customer_profiles add primary key(id);
alter table public.delivery_requests add primary key(id);
alter table public.delivery_status_logs add primary key(id);
alter table public.disputes add primary key(id);
alter table public.driver_documents add primary key(id);
alter table public.driver_earnings add primary key(id);
alter table public.driver_profiles add primary key(id);
alter table public.driver_vehicles add primary key(id);
alter table public.notifications add primary key(id);
alter table public.payments add primary key(id);
alter table public.payouts add primary key(id);
alter table public.ratings add primary key(id);
alter table public.shopping_items add primary key(id);
alter table public.shopping_substitutions add primary key(id);
alter table public.support_tickets add primary key(id);
alter table public.surge_pricing_settings add primary key(id);
alter table public.users add primary key(id);
alter table public.wallet_transactions add primary key(id);
alter table driver_locations add primary key(driver_id);alter table wallet_balances add primary key(user_id);create unique index delivery_payment_unique on payments(delivery_id);create unique index earning_delivery_unique on driver_earnings(delivery_id);create unique index document_type_unique on driver_documents(driver_id,document_type);create unique index payment_request_once on payments(customer_id,request_key);
create function public.is_admin() returns boolean language sql security definer set search_path=public as $$select exists(select 1 from users where id=auth.uid() and role='admin')$$;
create view admin_customer_accounts with(security_invoker=true) as select u.* from users u where role='customer' or exists(select 1 from customer_profiles c where c.id=u.id) or exists(select 1 from delivery_requests d where d.customer_id=u.id);
create view admin_driver_accounts with(security_invoker=true) as select u.* from users u where role='driver' or exists(select 1 from driver_profiles p where p.id=u.id);
alter table "busy_period_rules" enable row level security;create policy "Admin full access busy_period_rules" on "busy_period_rules" for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
alter table "delivery_requests" enable row level security;create policy "Admin full access deliveries" on "delivery_requests" for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
alter table "delivery_status_logs" enable row level security;create policy "delivery_status_logs_admin_insert" on "delivery_status_logs" for INSERT to authenticated with check (is_admin());
alter table "delivery_status_logs" enable row level security;create policy "delivery_status_logs_admin_select" on "delivery_status_logs" for SELECT to authenticated using (is_admin());
alter table "disputes" enable row level security;create policy "disputes_admin_select" on "disputes" for SELECT to authenticated using (is_admin());
alter table "disputes" enable row level security;create policy "disputes_admin_update" on "disputes" for UPDATE to authenticated using (is_admin()) with check (is_admin());
alter table "driver_documents" enable row level security;create policy "driver_documents_admin_select" on "driver_documents" for SELECT to authenticated using (is_admin());
alter table "driver_earnings" enable row level security;create policy "driver_earnings_admin_select" on "driver_earnings" for SELECT to authenticated using (is_admin());
alter table "driver_locations" enable row level security;create policy "admins read all locations" on "driver_locations" for SELECT to authenticated using ((EXISTS ( SELECT 1
   FROM users u
  WHERE ((u.id = auth.uid()) AND (u.role = 'admin'::text)))));
alter table "driver_vehicles" enable row level security;create policy "Admin full access driver_vehicles" on "driver_vehicles" for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
alter table "payments" enable row level security;create policy "payments_admin_select" on "payments" for SELECT to authenticated using (is_admin());
alter table "payouts" enable row level security;create policy "payouts_admin_select" on "payouts" for SELECT to authenticated using (is_admin());
alter table "payouts" enable row level security;create policy "payouts_admin_update" on "payouts" for UPDATE to authenticated using (is_admin()) with check (is_admin());
alter table "ratings" enable row level security;create policy "Admin full access ratings" on "ratings" for ALL to authenticated using ((EXISTS ( SELECT 1
   FROM users
  WHERE ((users.id = auth.uid()) AND (users.role = 'admin'::text)))));
alter table "support_tickets" enable row level security;create policy "support_tickets_admin_select" on "support_tickets" for SELECT to authenticated using (is_admin());
alter table "support_tickets" enable row level security;create policy "support_tickets_admin_update" on "support_tickets" for UPDATE to authenticated using (is_admin()) with check (is_admin());
grant usage on schema public,auth to anon,authenticated,service_role;grant all on all tables in schema public to service_role;grant select,insert,update,delete on all tables in schema public to authenticated;
CREATE OR REPLACE FUNCTION public.approve_driver_verification(p_driver uuid, p_actor uuid)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if not exists(select 1 from users where id=p_actor and role='admin') then raise exception 'admin_required'; end if;
 perform 1 from driver_profiles where id=p_driver and verification_submitted_at is not null for update;
 if not found or not driver_compliance_ready(p_driver) then raise exception 'valid_submitted_documents_required'; end if;
 update driver_profiles set status='approved' where id=p_driver;
end $function$;
CREATE OR REPLACE FUNCTION public.enforce_earning_snapshot()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare quoted numeric; service_price numeric;
begin
 select driver_earning_quote,price into quoted,service_price from delivery_requests where id=new.delivery_id;
 if quoted is not null then new.amount:=quoted;new.commission_amount:=service_price-quoted;end if;
 return new;
end $function$;
CREATE OR REPLACE FUNCTION public.record_completed_earnings()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare earning numeric;
begin
 if new.status='delivered' and old.status<>'delivered' then
  earning:=coalesce(new.driver_earning_quote,round(new.price*0.75,2));
  insert into driver_earnings(driver_id,delivery_id,amount,commission_amount,status) values(new.driver_id,new.id,earning,new.price-earning,'pending') on conflict(delivery_id) do nothing;
 end if;
 return new;
end $function$;
CREATE OR REPLACE FUNCTION public.snapshot_driver_earnings()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare config jsonb;
begin
 select booking_pricing into config from surge_pricing_settings where id=true;
 new.driver_earning_quote:=round(greatest(new.price*(1-coalesce((config->>'commissionPercent')::numeric,20)/100),coalesce((config->>'minimumDriverEarnings')::numeric,4.49)),2);
 return new;
end $function$;
CREATE OR REPLACE FUNCTION public.driver_compliance_ready(p_driver uuid)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
 select exists(select 1 from driver_vehicles where driver_id=p_driver)
 and not exists(
  select required from unnest(case when exists(select 1 from driver_vehicles where driver_id=p_driver and vehicle_type<>'bicycle')
   then array['identity','selfie','insurance','vehicle_registration'] else array['identity','selfie'] end) required
  where not exists(select 1 from driver_documents where driver_id=p_driver and document_type=required
   and (expires_on is null or expires_on>=(now() at time zone 'Europe/London')::date)
   and (required<>'insurance' or expires_on is not null)))
$function$;
CREATE OR REPLACE FUNCTION public.record_order_refund(p_payment_id uuid, p_key text, p_refund_id text, p_state text)
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
begin
 if p_state not in ('pending','requires_action','succeeded','failed','canceled') then raise exception 'invalid_refund_state'; end if;
 perform 1 from payments where id=p_payment_id for update;
 update payments set refund_jobs=(select jsonb_agg(case when r->>'key'=p_key and r->>'state' not in ('succeeded','failed','canceled') then r||jsonb_build_object('stripe_refund_id',p_refund_id,'state',p_state) else r end) from jsonb_array_elements(refund_jobs) r) where id=p_payment_id;
end $function$;
create trigger baseline_snapshot before insert on delivery_requests for each row execute function snapshot_driver_earnings();create trigger baseline_earning before insert on driver_earnings for each row execute function enforce_earning_snapshot();create trigger baseline_completed after update of status on delivery_requests for each row execute function record_completed_earnings();
CREATE OR REPLACE FUNCTION public.guard_driver_assignment()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
declare approved text; suitable boolean:=false; vehicle record;
begin
 if old.company_card_reference is not null and new.driver_id is distinct from old.driver_id then raise exception 'cancel_funded_shopping_before_reassignment'; end if;
 if new.driver_id is null or (new.driver_id is not distinct from old.driver_id and not(old.status='requested' and new.status='accepted')) then return new; end if;
 -- Serialize claims for this driver, including simultaneous claims of different jobs.
 select status into approved from driver_profiles where id=new.driver_id for update;
 if approved is distinct from 'approved' or not exists(select 1 from users where id=new.driver_id and role='driver') then raise exception 'driver_not_approved'; end if;
 if exists(select 1 from delivery_requests where driver_id=new.driver_id and id<>new.id and status in ('accepted','collected','picked_up','in_transit')) then raise exception 'driver_has_active_job'; end if;
 for vehicle in select vehicle_type from driver_vehicles where driver_id=new.driver_id for share loop
  if new.package_size is null or vehicle.vehicle_type='van' or (vehicle.vehicle_type='car' and new.package_size in ('small','medium','large')) or (vehicle.vehicle_type='motorcycle' and new.package_size in ('small','medium')) or (vehicle.vehicle_type='bicycle' and new.package_size='small') then suitable:=true; end if;
 end loop;
 if not suitable then raise exception 'suitable_vehicle_required'; end if;
 perform 1 from payments where delivery_id=new.id and status='paid' for share;
 if not found then raise exception 'confirmed_payment_required'; end if;
 return new;
end $function$;
create trigger guard_driver_assignment before update of driver_id on delivery_requests for each row execute function guard_driver_assignment();
