-- 033_drop_legacy_create_delivery.sql
-- ─────────────────────────────────────────────────────────────────────────────
-- Run ONLY AFTER the app version that calls create_delivery_with_wallet_payment_v2
-- is deployed (see 032). Drops every legacy overload of
-- create_delivery_with_wallet_payment() — they trust a caller-supplied price and
-- are executable by any logged-in user.
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'create_delivery_with_wallet_payment'
  loop
    execute 'drop function ' || r.sig;
  end loop;
end $$;
