import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import vm from "node:vm";
import { stripTypeScriptTypes } from "node:module";
import { PGlite } from "@electric-sql/pglite";
test("London overnight rules belong to the starting weekday, including summer time", () => {
  const api = vm.runInNewContext(
    stripTypeScriptTypes(fs.readFileSync("lib/pricing.ts", "utf8")).replace(
      /export /g,
      "",
    ) + ";({matchingBusyPeriodRules})",
    { Intl },
  );
  const rules = [
    {
      label: "Monday night",
      day_of_week: 1,
      start_time: "22:00",
      end_time: "02:00",
      active: true,
      multiplier: 1.2,
    },
  ];
  for (const [time, count] of [
    ["2026-10-26T01:00:00Z", 0],
    ["2026-10-26T22:00:00Z", 1],
    ["2026-10-27T01:59:00Z", 1],
    ["2026-10-27T02:00:00Z", 0],
    ["2026-07-06T21:00:00Z", 1],
    ["2026-07-07T00:59:00Z", 1],
    ["2026-07-07T01:00:00Z", 0],
  ])
    assert.equal(
      api.matchingBusyPeriodRules(rules, new Date(time)).length,
      count,
      time,
    );
});
test("Payout claims, rollback, reject/retry, payment reference and aggregated reports", async () => {
  const db = new PGlite();
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as 'select null::uuid';
 create table users(id uuid primary key,role text,full_name text,email text,phone text,created_at timestamp default now());
 create table driver_profiles(id uuid primary key,status text,is_online boolean default false);
 create table delivery_requests(id uuid primary key,driver_id uuid,status text,price numeric,driver_earning_quote numeric,created_at timestamp default now(),service_type text,bfm_stage text,shopping_problem jsonb,customer_id uuid,payment_method text,cancelled_by text,max_spend_approved numeric,shopping_hold_settled_at timestamptz);
 create table payouts(id uuid primary key default gen_random_uuid(),driver_id uuid,amount numeric,status text,processed_by uuid,processed_at timestamptz,created_at timestamp default now());
 create table driver_earnings(id uuid primary key default gen_random_uuid(),driver_id uuid,delivery_id uuid unique,amount numeric,commission_amount numeric,status text,created_at timestamp default now());
 create table shopping_substitutions(delivery_id uuid,customer_approved boolean,created_at timestamp default now());
 create table payments(delivery_id uuid,refund_jobs jsonb,created_at timestamp default now());
 create table wallet_transactions(id uuid primary key default gen_random_uuid(),user_id uuid,delivery_id uuid,type text,amount numeric,description text);
 create table wallet_balances(user_id uuid primary key,balance numeric,updated_at timestamptz);
 create table surge_pricing_settings(id int primary key);insert into surge_pricing_settings values(1);`);
  await db.exec(fs.readFileSync("supabase/pending-batches-11-14.sql", "utf8"));
  const driver = "00000000-0000-4000-8000-000000000001",
    admin = "00000000-0000-4000-8000-000000000002",
    job = "00000000-0000-4000-8000-000000000003";
  await db.query(
    "insert into users(id,role) values($1,'driver'),($2,'admin')",
    [driver, admin],
  );
  await db.query(
    "insert into driver_profiles(id,status) values($1,'approved')",
    [driver],
  );
  await db.query(
    "insert into delivery_requests(id,driver_id,status,price,driver_earning_quote) values($1,$2,'delivered',10,8)",
    [job, driver],
  );
  const reserve = async () =>
    (await db.query("select reserve_driver_payout($1) r", [driver])).rows[0].r;
  await db.exec(
    "alter table payouts add constraint force_failure check(amount<0)",
  );
  await assert.rejects(reserve);
  assert.equal(
    (await db.query("select count(*) n from driver_earnings")).rows[0].n,
    0,
  );
  await db.exec("alter table payouts drop constraint force_failure");
  const p = await reserve();
  assert.equal(Number(p.amount), 8);
  assert.equal((await reserve()).amount, 0);
  const review = (id, status, ref = null, actor = admin) =>
    db.query("select review_driver_payout($1,$2,$3,$4)", [
      id,
      actor,
      status,
      ref,
    ]);
  await assert.rejects(() => review(p.id, "paid"));
  await assert.rejects(() => review(p.id, "rejected", null, driver));
  await review(p.id, "rejected");
  const next = await reserve();
  assert.notEqual(next.id, p.id);
  await review(next.id, "approved");
  await review(next.id, "paid", "BANK-TEST-0001");
  await review(next.id, "paid", "BANK-TEST-0001");
  await assert.rejects(() => review(next.id, "paid", "OTHER-REF"));
  await assert.rejects(() => review(next.id, "rejected"));
  assert.equal(
    (await db.query("select status from driver_earnings")).rows[0].status,
    "paid",
  );
  assert.equal((await reserve()).amount, 0);
  await db.exec(
    "insert into delivery_requests(id,status,price) select gen_random_uuid(),'requested',999 from generate_series(1,1005)",
  );
  const report = (await db.query("select admin_report_snapshot($1) r", [admin]))
    .rows[0].r;
  assert.equal(report.orders, 1006);
  assert.equal(Number(report.serviceFees), 10);
  await assert.rejects(() =>
    db.query("select admin_report_snapshot($1)", [driver]),
  );
  for (let i = 0; i < 10; i++)
    assert.equal(
      (await db.query("select claim_public_geocode($1) r", ["a".repeat(64)]))
        .rows[0].r,
      true,
    );
  assert.equal(
    (await db.query("select claim_public_geocode($1) r", ["a".repeat(64)]))
      .rows[0].r,
    false,
  );
  assert.equal(
    (
      await db.query(
        "select has_function_privilege('authenticated','reserve_driver_payout(uuid)','EXECUTE') r",
      )
    ).rows[0].r,
    false,
  );
  const key = "00000000-0000-4000-8000-000000000004";
  await db.query(
    "update delivery_requests set customer_id=$2,payment_method='wallet',service_type='delivery' where id=$1",
    [job, driver],
  );
  await db.query(
    "insert into wallet_transactions(user_id,delivery_id,type,amount) values($1,$2,'deduction',10)",
    [driver, job],
  );
  const refund = (value = 3) =>
    db.query("select admin_wallet_refund($1,$2,$3,$4,false)", [
      job,
      admin,
      value,
      key,
    ]);
  await db.exec(
    "alter table wallet_balances add constraint fail_refund check(balance<0)",
  );
  await assert.rejects(() => refund());
  assert.equal(
    (
      await db.query(
        "select count(*) n from wallet_transactions where type='cashback'",
      )
    ).rows[0].n,
    0,
  );
  await db.exec("alter table wallet_balances drop constraint fail_refund");
  await refund();
  await refund();
  assert.equal(
    Number(
      (await db.query("select balance from wallet_balances")).rows[0].balance,
    ),
    3,
  );
  await assert.rejects(() => refund(4));
  await assert.rejects(() =>
    db.query("select admin_wallet_refund($1,$2,8,gen_random_uuid(),false)", [
      job,
      admin,
    ]),
  );
  const snapshot = (
    await db.query("select admin_payout_snapshot($1,1) r", [admin])
  ).rows[0].r;
  assert.equal(Number(snapshot.stats.totalPaidOut), 8);
  // Exercise the provider ledger on the same actual payout claims.
  await db.exec("alter table payments add column booking_draft jsonb,add column payment_method text,add column status text; alter table payouts add column admin_note text; alter table delivery_requests add column receipt_url text; create table driver_locations(driver_id uuid,delivery_id uuid,updated_at timestamptz);");
  await db.exec(fs.readFileSync("supabase/pending-bank-payouts.sql", "utf8"));
  await assert.rejects(() => db.query("select set_automatic_bank_payouts($1,true)",[driver]));
  await db.query("select set_automatic_bank_payouts($1,true)",[admin]);
  await db.query("update driver_profiles set stripe_connect_account_id='acct_test' where id=$1",[driver]);
  const token="00000000-0000-4000-8000-000000000099";
  assert.equal((await db.query("select claim_payout_worker($1) r",[token])).rows[0].r,true);
  assert.equal((await db.query("select claim_payout_worker(gen_random_uuid()) r")).rows[0].r,false);
  await db.query("insert into driver_earnings(driver_id,amount,status) values($1,12,'pending')",[driver]);
  const bank=await reserve();
  let operation=(await db.query("select start_bank_payout($1,'acct_test',$2) r",[bank.id,token])).rows[0].r;
  await assert.rejects(()=>db.query("select review_driver_payout($1,$2,'rejected',null)",[bank.id,admin]));
  await assert.rejects(()=>db.query("select save_bank_payout($1,$2)",[bank.id,{...operation,state:'paid'}]));
  operation={...operation,state:'pending',transfer_id:'tr_test',payout_id:'po_test'};
  await db.query("select save_bank_payout($1,$2)",[bank.id,operation]);
  assert.equal((await db.query("select status from driver_earnings where payout_id=$1",[bank.id])).rows[0].status,'reserved');
  await db.query("select save_bank_payout($1,$2)",[bank.id,{...operation,state:'paid'}]);
  await db.query("select save_bank_payout($1,$2)",[bank.id,{...operation,state:'paid'}]);
  assert.equal((await db.query("select status from driver_earnings where payout_id=$1",[bank.id])).rows[0].status,'paid');
  await db.query("select save_bank_payout($1,$2)",[bank.id,{...operation,state:'failed'}]);
  assert.equal((await db.query("select status from driver_earnings where payout_id=$1",[bank.id])).rows[0].status,'reserved');
  await assert.rejects(()=>db.query("select save_bank_payout($1,$2)",[bank.id,{...operation,payout_id:'po_other'}]));
  await db.exec(`insert into payments(payment_method,status,booking_draft,refund_jobs) values('stripe','paid','{"max_spend_approved":25}','[{"key":"unused-shopping","amount":5,"state":"succeeded"},{"amount":3,"state":"pending"}]');`);
  assert.equal(Number((await db.query("select payout_protected_funds() r")).rows[0].r),23);
  assert.equal((await db.query("select has_function_privilege('authenticated','save_bank_payout(uuid,jsonb)','execute') r")).rows[0].r,false);
  await db.exec(fs.readFileSync("supabase/pending-payout-recovery.sql", "utf8"));
  await assert.rejects(()=>db.query("select queue_bank_payout_retry($1,$2,'po_test','txn_return')",[bank.id,admin]));
  await db.exec("update surge_pricing_settings set payout_worker_until=null");
  await assert.rejects(()=>db.query("select queue_bank_payout_retry($1,$2,'po_test','txn_return')",[bank.id,driver]));
  await db.query("select queue_bank_payout_retry($1,$2,'po_test','txn_return')",[bank.id,admin]);
  const retry=(await db.query("select provider from payouts where id=$1",[bank.id])).rows[0].provider;
  assert.equal(retry.attempt,1);assert.equal(retry.transfer_id,'tr_test');assert.equal(retry.payout_id,undefined);
  await assert.rejects(()=>db.query("select queue_bank_payout_retry($1,$2,'po_test','txn_return')",[bank.id,admin]));
  await assert.rejects(()=>db.query("select save_bank_payout($1,$2)",[bank.id,{...operation,state:'paid'}]));
  await db.close();
});
