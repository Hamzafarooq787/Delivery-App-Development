-- 029_ratings.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Ratings & Reviews — customers and drivers rate each other after every
-- completed delivery. One rating per person per delivery, in either
-- direction (rater_role tells you which).
--
-- Moderation: every rating starts 'pending' and is only visible to the
-- person it's ABOUT once an admin approves it (see admin's Reviews page).
-- The person who WROTE it can always see their own, at any status, so they
-- know where it stands. This is why the table has a `status` column instead
-- of just being published on insert.
--
-- No INSERT/UPDATE/DELETE policy is granted to non-admins here — all writes
-- go through submitRating() / admin moderation actions (app/actions/ratings.ts),
-- which validate eligibility server-side before writing via the admin
-- client. This mirrors the delivery_requests lock-down pattern
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
  status text not null default 'pending' check (status in ('pending', 'approved', 'rejected')),
  moderated_at timestamptz,
  moderated_by uuid references users(id),
  created_at timestamptz not null default now(),
  unique (delivery_id, rater_id)
);

create index if not exists ratings_rated_id_idx on ratings (rated_id);
create index if not exists ratings_delivery_id_idx on ratings (delivery_id);
create index if not exists ratings_status_idx on ratings (status);

alter table ratings enable row level security;

drop policy if exists "Admin full access ratings" on ratings;
create policy "Admin full access ratings"
  on ratings for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

-- The rater can always see their own submission (any status, so they know
-- if it's pending/approved/rejected). The rated party only ever sees it
-- once an admin has approved it — that's the whole point of moderation.
drop policy if exists "Users can view ratings involving them" on ratings;
create policy "Users can view ratings involving them"
  on ratings for select
  using (
    auth.uid() = rater_id
    or (auth.uid() = rated_id and status = 'approved')
  );
