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
 create table delivery_requests(id uuid primary key,customer_id uuid,driver_id uuid,status text,service_type text,payment_method text,cancellation_policy jsonb,bfm_stage text,purchase_confirmed_at timestamptz,recovery_case jsonb,cancelled_by text,shopping_hold_settled_at timestamptz,receipt_url text,actual_items_total numeric,company_card_reference text,company_card_verified_at timestamptz,purchase_authorized_at timestamptz,purchase_authorized_total numeric,max_spend_approved numeric,created_at timestamptz,tracking_number text);
 create table shopping_items(id uuid primary key default gen_random_uuid(),delivery_id uuid,status text,confirmed_unit_price numeric,estimated_price numeric,quantity integer);
 create table shopping_substitutions(shopping_item_id uuid,delivery_id uuid,customer_approved boolean,suggested_price numeric,customer_responded_at timestamptz);
 create table payments(id uuid primary key default gen_random_uuid(),delivery_id uuid,related_delivery_id uuid,purpose text default 'booking',status text default 'paid',payment_method text default 'stripe',amount numeric,refund_jobs jsonb default '[]',stripe_payment_intent text);
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
 await db.exec(source.slice(source.indexOf('create or replace function public.prepare_company_purchase'),source.indexOf('create or replace function public.freeze_authorized_basket')))
 const receiptSource=fs.readFileSync('supabase/migrations/20261030195527_batches_1_4_shopping_safety.sql','utf8')
 let receipt=receiptSource.slice(receiptSource.indexOf('create or replace function public.settle_shopping_receipt_atomic'),receiptSource.indexOf('-- Prevent item/approval edits'))
 receipt=receipt.replace('if v_refund>0 then',"if v_refund>0 and v_order.payment_method='stripe' then perform public.queue_order_refund(p_delivery_id,'unused-shopping',v_refund); end if; if v_refund>0 and v_order.payment_method<>'stripe' then")
 await db.exec(receipt)
 await db.exec(migration)
 await db.exec(fs.readFileSync("supabase/migrations/20261105053922_qa17_postcollection_cancellation.sql","utf8"))
 await db.exec(fs.readFileSync("supabase/migrations/20261105054441_qa17_cancellation_null_guard.sql","utf8"))
 await db.exec(fs.readFileSync("supabase/migrations/20261105075614_qa18_grace_and_sandbox.sql","utf8"))
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
  await db.exec("update delivery_requests set travel_started_at=now()-interval '3 minutes'")
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
  await db.exec("update delivery_requests set travel_started_at=now()-interval '3 minutes'")
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
  const imports={'@/lib/payments/shopping-sandbox':{isShoppingSimulation:()=>false},'@/lib/admin-access':{runAdminMutation:async(a,b,c,fn)=>fn(),getAdminActor:async()=>({id:admin})},'@/lib/supabase/server':{},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query})},'@/lib/stripe/server':{getStripe:()=>stripe},'@/lib/notifications/internal':{},'next/cache':{}}
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
  await db.exec(`update surge_pricing_settings set cancellation_settings='{"travelFee":9,"travelDriver":8,"arrivedFee":10,"arrivedDriver":9,"graceMinutes":2}'`)
  await db.exec("update delivery_requests set travel_started_at=now()-interval '3 minutes'")
  assert.equal((await quote(db)).fee,2.5)
 }finally{await db.close()}
})

test('Collected parcels retain the agreed arrival fee, while driver fault is fully refunded and opens safe return',async()=>{
 for(const fault of ['customer','driver']){
  const db=await database()
  try{
   await db.query("select collection_milestone($1,$2,'travel')",[driver,job])
   await db.query("select collection_milestone($1,$2,'arrived')",[driver,job])
   await db.exec("update delivery_requests set status='collected'")
   const actor=fault==='customer'?customer:driver
   const q=await quote(db,actor,fault)
   assert.equal(q.review,false);assert.equal(q.fee,fault==='customer'?3.5:0)
   await cancel(db,q.fee,actor,fault)
   const state=(await db.query('select status,recovery_case from delivery_requests')).rows[0]
   assert.equal(state.status,'cancelled');assert.equal(state.recovery_case.action,'return_to_pickup')
  }finally{await db.close()}
 }
})

test('Both booking flows expose cancellation terms before the payment action, outside the success screen',()=>{
 const parcel=fs.readFileSync('components/customer/NewDeliveryModal.tsx','utf8')
 const normalFooter=parcel.slice(parcel.lastIndexOf('<footer className={styles.footer}>'))
 assert.match(normalFooter,/step === 3 && <CancellationPolicyNotice\/>/)
 assert.ok(normalFooter.indexOf('<CancellationPolicyNotice')<normalFooter.indexOf('Confirm & Pay'))
 const shopping=fs.readFileSync('components/customer/ShoppingBookingForm.tsx','utf8')
 assert.match(shopping,/step===4 && <CancellationPolicyNotice\/>/)
})

test('Unassigned orders cannot be previewed or cancelled by an unrelated customer; malformed fees cannot reach quotes',async()=>{
 const db=await database()
 try{
  await db.exec("update delivery_requests set status='requested',driver_id=null")
  await assert.rejects(quote(db,other),/order_unavailable/)
  await assert.rejects(cancel(db,0,other),/order_unavailable/)
  await assert.rejects(db.exec(`update surge_pricing_settings set cancellation_settings='{}'`))
  assert.equal((await db.query('select status from delivery_requests')).rows[0].status,'requested')
  assert.equal((await db.query('select refund_jobs from payments')).rows[0].refund_jobs.length,0)
 }finally{await db.close()}
})

for(const scenario of [
 {name:'Buy for Me en route after grace',shopping:true,seconds:121,fee:2.5,driverPay:2},
 {name:'Collect & Deliver arrived during grace',arrived:true,seconds:10,fee:3.5,driverPay:3},
 {name:'Collect & Deliver en route after grace',seconds:121,fee:2.5,driverPay:2},
 {name:'Accepted without travel',seconds:null,fee:0,driverPay:0},
 {name:'Collect & Deliver in grace',seconds:119,fee:0,driverPay:0},
 {name:'Buy for Me in grace',shopping:true,seconds:30,fee:0,driverPay:0},
])test(`QA18: ${scenario.name} retains the exact fee, refund and compensation`,async()=>{
 const db=await database()
 try{
  if(scenario.shopping)await db.exec("update delivery_requests set service_type='buy_for_me'")
  if(scenario.seconds!==null)await db.query("update delivery_requests set travel_started_at=clock_timestamp()-make_interval(secs=>$1)",[scenario.seconds])
  if(scenario.arrived)await db.exec('update delivery_requests set arrived_at=now()')
  const q=await quote(db)
  assert.equal(q.fee,scenario.fee);assert.equal(q.driver,scenario.driverPay);assert.equal(q.refund,15.69-scenario.fee)
  if(scenario.seconds!==null&&scenario.seconds<120&&!scenario.arrived){assert.ok(q.graceSeconds>0);assert.ok(q.graceExpiresAt)}else assert.equal(q.graceSeconds,0)
  await cancel(db,q.fee)
  const refunds=(await db.query('select refund_jobs from payments')).rows[0].refund_jobs
  assert.equal(refunds[0].amount,Number((15.69-scenario.fee).toFixed(2)))
  const earnings=(await db.query('select amount from driver_earnings')).rows
  assert.equal(earnings.length,scenario.driverPay?1:0)
  if(earnings.length)assert.equal(Number(earnings[0].amount),scenario.driverPay)
 }finally{await db.close()}
})

test('QA18: grace expires on the server and a stale free quote cannot waive the travel fee',async()=>{
 const db=await database()
 try{
  await db.exec("update delivery_requests set travel_started_at=clock_timestamp()-interval '119 seconds'")
  assert.equal((await quote(db)).fee,0)
  await db.exec("update delivery_requests set travel_started_at=clock_timestamp()-interval '120 seconds'")
  assert.equal((await quote(db)).fee,2.5)
  await assert.rejects(cancel(db,0),/fee_changed/)
  assert.equal((await db.query('select status from delivery_requests')).rows[0].status,'accepted')
  await cancel(db,2.5);await cancel(db,2.5)
  assert.equal((await db.query('select refund_jobs from payments')).rows[0].refund_jobs.length,1)
 }finally{await db.close()}
})

test('QA18: admin grace is bounded and editable; arrival and purchased shopping never gain grace',async()=>{
 const db=await database()
 try{
  await db.exec("update surge_pricing_settings set cancellation_settings=jsonb_set(cancellation_settings,'{graceMinutes}','5');update delivery_requests set travel_started_at=now()-interval '4 minutes'")
  assert.equal((await quote(db)).fee,0)
  await db.exec("update surge_pricing_settings set cancellation_settings=jsonb_set(cancellation_settings,'{graceMinutes}','0')")
  assert.equal((await quote(db)).fee,2.5)
  for(const value of [-1,1.5,61])await assert.rejects(db.query("update surge_pricing_settings set cancellation_settings=jsonb_set(cancellation_settings,'{graceMinutes}',$1::jsonb)",[JSON.stringify(value)]))
  await db.exec("update surge_pricing_settings set cancellation_settings=jsonb_set(cancellation_settings,'{graceMinutes}','5');update delivery_requests set arrived_at=now()")
  assert.equal((await quote(db)).fee,3.5)
  await db.exec("update delivery_requests set service_type='buy_for_me',purchased_at=now()")
  assert.equal((await cancel(db,0)).review,true)
  assert.equal((await db.query('select refund_jobs from payments')).rows[0].refund_jobs.length,0)
 }finally{await db.close()}
})

test('QA18: sandbox simulation requires finance, an approved assigned driver and its paid booking',async()=>{
 const db=await database()
 try{
  await db.exec("update delivery_requests set service_type='buy_for_me',max_spend_approved=50;update payments set stripe_payment_intent='pi_sandbox',amount=58.48")
  const enable=actor=>db.query('select enable_shopping_simulation($1,$2,$3)',[actor,job,'pi_sandbox'])
  await assert.rejects(enable(customer),/finance_required/)
  await db.exec("update payments set status='pending'")
  await assert.rejects(enable(admin),/paid_test_booking_required/)
  await db.exec("update payments set status='paid';update driver_profiles set status='pending'")
  await assert.rejects(enable(admin),/approved_driver_required/)
  await db.exec("update driver_profiles set status='approved';update delivery_requests set company_card_reference='ic_real'")
  await assert.rejects(enable(admin),/real_card_assigned/)
  await db.exec('update delivery_requests set company_card_reference=null')
  await enable(admin);await enable(admin)
  assert.equal((await db.query('select count(*) n from shopping_sandbox_sessions')).rows[0].n,1)
  assert.equal((await db.query('select company_card_reference from delivery_requests')).rows[0].company_card_reference,`sandbox_${job}`)
  assert.equal((await db.query("select has_table_privilege('authenticated','shopping_sandbox_sessions','insert') allowed")).rows[0].allowed,false)
  assert.equal((await db.query("select has_function_privilege('authenticated','enable_shopping_simulation(uuid,uuid,text)','execute') allowed")).rows[0].allowed,false)
 }finally{await db.close()}
})

test('QA18: simulated purchase retains basket approval checks, queues the difference refund once and requires review after purchase',async()=>{
 const db=await database()
 try{
  await db.exec("update delivery_requests set service_type='buy_for_me',max_spend_approved=50;update payments set stripe_payment_intent='pi_sandbox',amount=58.48")
  await db.query('select enable_shopping_simulation($1,$2,$3)',[admin,job,'pi_sandbox'])
  await db.exec("update delivery_requests set status='collected',bfm_stage='shopping';insert into shopping_items(delivery_id,status,estimated_price,confirmed_unit_price,quantity) select id,'purchased',5,6,1 from delivery_requests")
  await assert.rejects(db.query('select prepare_company_purchase($1,$2)',[job,driver]),/higher_price_requires_approval/)
  await db.exec('update shopping_items set confirmed_unit_price=5')
  assert.equal(Number((await db.query('select prepare_company_purchase($1,$2) total',[job,driver])).rows[0].total),5)
  await assert.rejects(db.query('select record_sandbox_purchase($1,$2,5)',[job,other]),/simulation_not_ready/)
  await assert.rejects(db.query('select record_sandbox_purchase($1,$2,6)',[job,driver]),/unapproved_basket/)
  await db.query('select record_sandbox_purchase($1,$2,5)',[job,driver])
  assert.equal(Number((await db.query('select simulated_spent from shopping_sandbox_sessions')).rows[0].simulated_spent),5)
  assert.equal((await quote(db)).review,true)
  const receipt=()=>db.query("select settle_shopping_receipt_atomic($1,$2,'test-receipt',5) result",[job,driver])
  assert.equal((await receipt()).rows[0].result.refund,45)
  assert.equal((await receipt()).rows[0].result.replayed,true)
  const rows=(await db.query('select refund_jobs from payments')).rows[0].refund_jobs
  assert.equal(rows.length,1);assert.equal(rows[0].amount,45)
 }finally{await db.close()}
})
