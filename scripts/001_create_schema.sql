create table if not exists users (
  id uuid primary key references auth.users(id) on delete cascade,
  role text check (role in ('customer', 'driver', 'admin')) default 'customer',
  full_name text,
  phone text,
  created_at timestamp default now()
);

create table if not exists customer_profiles (
  id uuid primary key references users(id) on delete cascade,
  default_address text,
  created_at timestamp default now()
);

create table if not exists driver_profiles (
  id uuid primary key references users(id) on delete cascade,
  status text check (status in ('pending', 'approved', 'rejected')) default 'pending',
  vehicle_type text,
  vehicle_number text,
  insurance_details text,
  created_at timestamp default now()
);

create table if not exists driver_documents (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references driver_profiles(id) on delete cascade,
  document_type text,
  file_url text,
  created_at timestamp default now()
);

create table if not exists addresses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id) on delete cascade,
  address text,
  lat numeric,
  lng numeric,
  created_at timestamp default now()
);

create table if not exists delivery_requests (
  id uuid primary key default gen_random_uuid(),
  tracking_number text unique,
  customer_id uuid references users(id),
  driver_id uuid references users(id),
  pickup_address text,
  pickup_lat numeric,
  pickup_lng numeric,
  delivery_address text,
  delivery_lat numeric,
  delivery_lng numeric,
  item_description text,
  item_value numeric,
  price numeric,
  status text check (
    status in (
      'requested',
      'accepted',
      'collected',
      'in_transit',
      'delivered',
      'cancelled'
    )
  ) default 'requested',
  is_safe_confirmed boolean default false,
  created_at timestamp default now()
);

create table if not exists delivery_status_logs (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references delivery_requests(id) on delete cascade,
  status text,
  updated_by uuid references users(id),
  created_at timestamp default now()
);

create table if not exists proof_uploads (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references delivery_requests(id) on delete cascade,
  type text check (type in ('pickup', 'delivery')),
  file_url text,
  created_at timestamp default now()
);

create table if not exists payments (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references delivery_requests(id),
  amount numeric,
  status text check (status in ('pending', 'paid', 'released', 'failed')) default 'pending',
  stripe_payment_intent text,
  created_at timestamp default now()
);

create table if not exists driver_earnings (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references users(id),
  delivery_id uuid references delivery_requests(id),
  amount numeric,
  status text check (status in ('pending', 'paid')) default 'pending',
  created_at timestamp default now()
);

create table if not exists disputes (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid references delivery_requests(id),
  raised_by uuid references users(id),
  issue text,
  status text check (status in ('open', 'resolved', 'rejected')) default 'open',
  created_at timestamp default now()
);

create table if not exists support_tickets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  subject text,
  message text,
  status text check (status in ('open', 'closed')) default 'open',
  created_at timestamp default now()
);

create table if not exists payment_methods (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references users(id),
  stripe_customer_id text,
  created_at timestamp default now()
);

create table if not exists payouts (
  id uuid primary key default gen_random_uuid(),
  driver_id uuid references users(id),
  amount numeric,
  status text check (status in ('pending', 'paid')) default 'pending',
  created_at timestamp default now()
);
