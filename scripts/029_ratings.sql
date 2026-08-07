-- 029_ratings.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ratings & Reviews — customers and drivers rate each other after every
-- completed delivery. One rating per person per delivery, in either
-- direction (rater_role tells you which).
--
-- No INSERT/UPDATE/DELETE policy is granted to non-admins here — all writes
-- go through submitRating() (app/actions/ratings.ts), which validates the
-- rater actually took part in a DELIVERED order before writing via the
-- admin client. This mirrors the delivery_requests lock-down pattern
-- (scripts/026_payment_before_dispatch.sql): the table itself is the
-- single legitimate write path, not raw client access.
--
-- Run in the Supabase SQL editor.

create table if not exists ratings (
  id uuid primary key default gen_random_uuid(),
  delivery_id uuid not null references delivery_requests(id) on delete cascade,
  rater_id uuid not null references users(id) on delete cascade,
  rated_id uuid not null references users(id) on delete cascade,
  rater_role text not null check (rater_role in ('customer', 'driver')),
  score int not null check (score between 1 and 5),
  comment text,
  created_at timestamptz not null default now(),
  unique (delivery_id, rater_id)
);

create index if not exists ratings_rated_id_idx on ratings (rated_id);
create index if not exists ratings_delivery_id_idx on ratings (delivery_id);

alter table ratings enable row level security;

drop policy if exists "Admin full access ratings" on ratings;
create policy "Admin full access ratings"
  on ratings for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Users can view ratings involving them" on ratings;
create policy "Users can view ratings involving them"
  on ratings for select
  using (auth.uid() = rater_id or auth.uid() = rated_id);
