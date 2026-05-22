-- =============================================
-- Live Chat: sessions + messages
-- =============================================

-- 1. chat_sessions (one per driver)
create table if not exists chat_sessions (
  id            uuid primary key default gen_random_uuid(),
  driver_id     uuid not null references auth.users(id) on delete cascade,
  driver_unread int  not null default 0,
  admin_unread  int  not null default 0,
  last_message_at timestamptz default now(),
  created_at    timestamptz default now()
);
create unique index if not exists chat_sessions_driver_idx on chat_sessions(driver_id);
create index if not exists chat_sessions_last_msg_idx on chat_sessions(last_message_at desc);

-- 2. chat_messages
create table if not exists chat_messages (
  id          uuid primary key default gen_random_uuid(),
  session_id  uuid not null references chat_sessions(id) on delete cascade,
  sender_id   uuid not null references auth.users(id) on delete cascade,
  sender_role text not null check (sender_role in ('driver','admin')),
  content     text not null,
  created_at  timestamptz not null default now()
);
create index if not exists chat_messages_session_idx on chat_messages(session_id, created_at asc);

-- 3. RLS on chat_sessions
alter table chat_sessions enable row level security;

drop policy if exists "Driver sees own session" on chat_sessions;
create policy "Driver sees own session" on chat_sessions for select
  using (auth.uid() = driver_id);

drop policy if exists "Driver inserts own session" on chat_sessions;
create policy "Driver inserts own session" on chat_sessions for insert
  with check (auth.uid() = driver_id);

drop policy if exists "Driver updates own session" on chat_sessions;
create policy "Driver updates own session" on chat_sessions for update
  using (auth.uid() = driver_id);

drop policy if exists "Admin full access sessions" on chat_sessions;
create policy "Admin full access sessions" on chat_sessions for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Service role sessions" on chat_sessions;
create policy "Service role sessions" on chat_sessions for all
  using (true) with check (true);

-- 4. RLS on chat_messages
alter table chat_messages enable row level security;

drop policy if exists "Driver sees own messages" on chat_messages;
create policy "Driver sees own messages" on chat_messages for select
  using (
    exists (select 1 from chat_sessions cs where cs.id = session_id and cs.driver_id = auth.uid())
  );

drop policy if exists "Driver inserts own messages" on chat_messages;
create policy "Driver inserts own messages" on chat_messages for insert
  with check (
    sender_role = 'driver' and auth.uid() = sender_id and
    exists (select 1 from chat_sessions cs where cs.id = session_id and cs.driver_id = auth.uid())
  );

drop policy if exists "Admin full access messages" on chat_messages;
create policy "Admin full access messages" on chat_messages for all
  using (exists (select 1 from users where id = auth.uid() and role = 'admin'));

drop policy if exists "Service role messages" on chat_messages;
create policy "Service role messages" on chat_messages for all
  using (true) with check (true);

-- 5. Enable Realtime
do $$ begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_sessions') then
    alter publication supabase_realtime add table chat_sessions;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and tablename='chat_messages') then
    alter publication supabase_realtime add table chat_messages;
  end if;
end $$;

-- 6. Trigger: notify on new chat message
create or replace function notify_chat_message()
returns trigger language plpgsql security definer set search_path = public set row_security = off as $$
declare
  sess record;
  admin_rec record;
  driver_name text;
begin
  select * into sess from chat_sessions where id = new.session_id;

  if new.sender_role = 'driver' then
    -- Update admin_unread + last_message_at
    update chat_sessions set admin_unread = admin_unread + 1, last_message_at = now() where id = new.session_id;
    -- Get driver name
    select coalesce(full_name, email, 'Driver') into driver_name from users where id = sess.driver_id;
    -- Notify all admins
    for admin_rec in select id from users where role = 'admin' loop
      insert into notifications(user_id, title, body)
      values (admin_rec.id, 'New Driver Message', driver_name || ': ' || left(new.content, 80));
    end loop;

  elsif new.sender_role = 'admin' then
    -- Update driver_unread + last_message_at
    update chat_sessions set driver_unread = driver_unread + 1, last_message_at = now() where id = new.session_id;
    -- Notify driver
    insert into notifications(user_id, title, body)
    values (sess.driver_id, 'Support Reply', 'Admin: ' || left(new.content, 80));
  end if;

  return new;
end;
$$;

drop trigger if exists on_chat_message on chat_messages;
create trigger on_chat_message
  after insert on chat_messages
  for each row execute function notify_chat_message();
