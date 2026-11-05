import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {PGlite} from '@electric-sql/pglite'
const driver='00000000-0000-4000-8000-000000000001',customer='00000000-0000-4000-8000-000000000002',admin='00000000-0000-4000-8000-000000000003',job='00000000-0000-4000-8000-000000000004',other='00000000-0000-4000-8000-000000000005'
const migration=fs.readFileSync('supabase/migrations/20261105051940_qa17_cancellation_policy.sql','utf8')
async function database(){
 const db=new PGlite()
 await db.exec(`
 create role anon;create role authenticated;create role service_role;
 create schema auth;create function auth.uid() returns uuid language sql as 'select nullif(current_setting(''request.jwt.claim.sub'',true),'''')::uuid';
 create schema godrop_private;create function godrop_private.admin_has_scope(actor uuid,scope text) returns boolean language sql as 'select actor=''${admin}''::uuid';
 create table users(id uuid primary key,role text,account_status text);
 create table driver_profiles(id uuid primary key,status text);
 create table surge_pricing_settings(id boolean primary key);insert into surge_pricing_settings values(true);
 create table delivery_requests(id uuid primary key,customer_id uuid,driver_id uuid,status text,service_type text,payment_method text,cancellation_policy jsonb,bfm_stage text,purchase_confirmed_at timestamptz,recovery_case jsonb,cancelled_by text,shopping_hold_settled_at timestamptz,max_spend_approved numeric,created_at timestamptz,tracking_number text);
 create table payments(id uuid primary key default gen_random_uuid(),delivery_id uuid,related_delivery_id uuid,purpose text default 'booking',status text default 'paid',payment_method text default 'stripe',amount numeric,refund_jobs jsonb default '[]');
 create table wallet_transactions(user_id uuid,type text,amount numeric,description text,delivery_id uuid);
 create table wallet_balances(user_id uuid primary key,balance numeric,updated_at timestamptz);
 create table driver_earnings(driver_id uuid,recovery_delivery_id uuid unique,amount numeric,commission_amount numeric,status text);
 create function handle_driver_cancellation() returns trigger language plpgsql as 'begin if new.cancelled_by=''driver'' and new.status=''cancelled'' and old.status<>''cancelled'' then insert into wallet_transactions(user_id,type,amount,delivery_id) values(new.customer_id,''cashback'',99,new.id);end if;return new;end';
 create trigger legacy_driver_refund after update on delivery_requests for each row execute function handle_driver_cancellation();
 create table admin_audit_log(actor_id uuid,event text,entity text,details jsonb);
 create function append_admin_audit(uuid,text,text,jsonb) returns void language plpgsql as 'begin raise exception ''admin_required'';end';
 insert into users values('${driver}','driver','active'),('${customer}','customer','active'),('${admin}','admin','active'),('${other}','customer','active');
 insert into driver_profiles values('${driver}','approved');
 insert into delivery_requests(id,customer_id,driver_id,status,service_type,payment_method) values('${job}','${customer}','${driver}','accepted','delivery','stripe');
 insert into payments(delivery_id,amount) values('${job}',15.69);
 `)
 const source=fs.readFileSync('supabase/migrations/20261030211100_direct_checkout_and_shopping_operations.sql','utf8')
 await db.exec(source.slice(source.indexOf('create or replace function public.queue_order_refund'),source.indexOf('-- Legacy wallet refund')))
 await db.exec(migration)
 return db
}
async function quote(db,actor=customer,fault='customer'){return (await db.query('select cancellation_quote($1,$2,$3) q',[actor,job,fault])).rows[0].q}
async function cancel(db,fee,actor=customer,fault='customer'){return (await db.query('select cancel_with_policy($1,$2,$3,$4,$5) q',[actor,job,fee,'QA cancellation',fault])).rows[0].q}
test('Free before acceptance and after acceptance; quoted travel and arrival fees split exactly and refunds retry once',async()=>{
 const db=await database()
 try{
  await db.query("update delivery_requests set status='requested',driver_id=null where id=$1",[job]);assert.equal((await quote(db)).fee,0)
  await db.query("update delivery_requests set status='accepted',driver_id=$1 where id=$2",[driver,job]);assert.ok((await db.query('select accepted_at from delivery_requests')).rows[0].accepted_at)
  assert.equal((await quote(db)).refund,15.69)
  await db.query("select collection_milestone($1,$2,'travel')",[driver,job])
  let q=await quote(db);assert.equal(q.fee,2.5);assert.equal(q.driver,2);assert.equal(q.platform,0.5);assert.equal(q.refund,13.19)
  await assert.rejects(cancel(db,0),/fee_changed/)
  await db.query("select collection_milestone($1,$2,'arrived')",[driver,job])
  q=await quote(db);assert.equal(q.fee,3.5);assert.equal(q.driver,3);assert.equal(q.platform,0.5);assert.equal(q.refund,12.19)
  await assert.rejects(cancel(db,2.5),/fee_changed/)
  await cancel(db,3.5);await cancel(db,3.5)
  const p=(await db.query('select refund_jobs from payments')).rows[0];assert.equal(p.refund_jobs.length,1);assert.equal(p.refund_jobs[0].amount,12.19)
  assert.deepEqual((await db.query('select amount,commission_amount from driver_earnings')).rows.map(x=>({amount:Number(x.amount),commission_amount:Number(x.commission_amount)})),[{amount:3,commission_amount:0.5}])
 }finally{await db.close()}
})
test('Driver fault and no-show refund in full; customers cannot claim a fault waiver themselves',async()=>{
 const db=await database()
 try{
  await db.query("select collection_milestone($1,$2,'travel')",[driver,job])
  await assert.rejects(quote(db,customer,'driver'),/support_review_required/)
  assert.equal((await quote(db,admin,'no_show')).fee,0)
  const q=await cancel(db,0,driver,'driver');assert.equal(q.refund,15.69);assert.equal(q.driver,0)
  assert.equal((await db.query('select count(*) n from driver_earnings')).rows[0].n,0)
  await assert.rejects(quote(db,other),/order_unavailable/)
 }finally{await db.close()}
})
test('Purchased shopping enters admin review without cancellation, refund or extra purchases',async()=>{
 const db=await database()
 try{
  await db.query("update delivery_requests set service_type='buy_for_me',bfm_stage='heading_to_shop' where id=$1",[job])
  assert.equal((await quote(db)).fee,2.5)
  await db.query("update delivery_requests set bfm_stage='arrived_at_shop' where id=$1",[job])
  assert.equal((await quote(db)).fee,3.5)
  await db.query("update delivery_requests set bfm_stage='purchase_completed',purchase_confirmed_at=now() where id=$1",[job])
  const q=await cancel(db,0);assert.equal(q.review,true)
  assert.deepEqual((await db.query('select status,recovery_case, purchased_at from delivery_requests')).rows.map(x=>[x.status,x.recovery_case.status,!!x.purchased_at]),[['accepted','open',true]])
  assert.equal((await db.query('select refund_jobs from payments')).rows[0].refund_jobs.length,0)
  await assert.rejects(db.exec("update delivery_requests set bfm_stage='heading_to_customer'"),/admin_cancellation_review_required/)
 }finally{await db.close()}
})
test('Persistent declines are scoped to approved drivers and only open pool jobs',async()=>{
 const db=await database()
 try{
  await db.exec("update delivery_requests set status='requested',driver_id=null")
  await db.query('select decline_driver_job($1,$2)',[driver,job]);await db.query('select decline_driver_job($1,$2)',[driver,job])
  assert.deepEqual((await db.query('select declined_jobs from driver_profiles')).rows[0].declined_jobs,[job])
  await assert.rejects(db.query('select decline_driver_job($1,$2)',[customer,job]),/approved_driver_required/)
 }finally{await db.close()}
})

test('Wallet cancellation credits only the policy refund, with no legacy driver cashback duplication',async()=>{
 const db=await database()
 try{
  await db.exec("update delivery_requests set payment_method='wallet';insert into wallet_transactions(user_id,type,amount,delivery_id) select customer_id,'deduction',15.69,id from delivery_requests")
  const q=await cancel(db,0,driver,'driver')
  assert.equal(q.refund,15.69)
  const row=(await db.query("select count(*) n,sum(amount) total from wallet_transactions where type='cashback'")).rows[0]
  assert.equal(row.n,1);assert.equal(Number(row.total),15.69)
 }finally{await db.close()}
})

test('Sandbox issuing card tool refuses live keys and live provider objects before any card is created',async()=>{
 const vm=await import('node:vm'),ts=await import('typescript')
 async function run(key,live){
  let writes=0,reads=0
  const query={select:()=>query,eq:()=>query,maybeSingle:async()=>({data:reads++===0?{id:job,driver_id:driver,status:'accepted',service_type:'buy_for_me',max_spend_approved:50}:{stripe_payment_intent:'pi_test'}})}
  const stripe={balance:{retrieve:async()=>({livemode:live})},paymentIntents:{retrieve:async()=>({livemode:live})},issuing:{cardholders:{create:async()=>{writes++;return {id:'ich_test'}}},cards:{create:async()=>{writes++;return {id:'ic_test',livemode:false}}}}}
  const imports={'@/lib/admin-access':{runAdminMutation:async(a,b,c,fn)=>fn(),getAdminActor:async()=>({id:admin})},'@/lib/supabase/server':{},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query})},'@/lib/stripe/server':{getStripe:()=>stripe},'@/lib/notifications/internal':{},'next/cache':{}}
  const exports={}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync('app/actions/shopping-operations.ts','utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>imports[name],process:{env:{STRIPE_SECRET_KEY:key}}})
  const result=await exports.createSandboxShoppingCard(job)
  return {result,writes}
 }
 for(const [key,live] of [['sk_live_test',false],['sk_test_test',true]]){
  const {result,writes}=await run(key,live);assert.ok(result.error);assert.equal(writes,0)
 }
 const {result,writes}=await run('sk_test_test',false);assert.equal(result.cardId,'ic_test');assert.equal(writes,2)
})

test('New bookings retain their recorded cancellation fees after an administrator changes settings',async()=>{
 const db=await database()
 try{
  await db.exec("delete from payments;delete from delivery_requests")
  await db.query("insert into delivery_requests(id,customer_id,driver_id,status,service_type,payment_method) values($1,$2,$3,'accepted','delivery','stripe')",[job,customer,driver])
  await db.query("insert into payments(delivery_id,amount) values($1,15.69)",[job])
  await db.query("select collection_milestone($1,$2,'travel')",[driver,job])
  await db.exec(`update surge_pricing_settings set cancellation_settings='{"travelFee":9,"travelDriver":8,"arrivedFee":10,"arrivedDriver":9}'`)
  assert.equal((await quote(db)).fee,2.5)
 }finally{await db.close()}
})
