import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {PGlite} from '@electric-sql/pglite';
const checks=vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('lib/shopping-validation.ts','utf8')).replace(/export /g,'')+';({validateShoppingItems,normalizeBfmSettings})');
const item={name:'Milk',quantity:2,estimated_price:1.5,substitution_preference:'contact_me'};
test('reject invalid shopping input and normalize enabled settings',()=>{assert.equal(checks.validateShoppingItems([item]),null);for(const v of [[],Array(16).fill(item),[{...item,quantity:-1}],[{...item,quantity:1.5}],[{...item,estimated_price:NaN}],[{...item,estimated_price:-1}]])assert.ok(checks.validateShoppingItems(v));assert.equal(checks.normalizeBfmSettings({service_enabled:true,max_purchase_amount:50,service_fee_percentage:10}).enabled,true);assert.equal(checks.normalizeBfmSettings({enabled:false,service_enabled:true,max_purchase_amount:50,service_fee_percentage:10}).enabled,false)});
const fixture=`create role anon;create role authenticated;create role service_role;create schema auth;create function auth.uid() returns uuid language sql as 'select null::uuid';create schema storage;create table storage.buckets(id text,public boolean);create table storage.objects(name text,bucket_id text);create function storage.foldername(text) returns text[] language sql as 'select string_to_array($1,''/'')';create table users(id uuid,role text);
create table delivery_requests(id uuid primary key default gen_random_uuid(),customer_id uuid,driver_id uuid,tracking_number text,status text,pickup_address text,pickup_lat numeric,pickup_lng numeric,delivery_address text,delivery_lat numeric,delivery_lng numeric,package_size text,price numeric,base_price numeric,is_safe_confirmed boolean,cancelled_by text);
create table wallet_balances(user_id uuid primary key,balance numeric,updated_at timestamptz);create table wallet_transactions(user_id uuid,type text,amount numeric,description text,delivery_id uuid);create table payments(delivery_id uuid,amount numeric,status text);
create table shopping_items(id uuid default gen_random_uuid(),delivery_id uuid,name text,quantity int,estimated_price numeric,brand_size_variant text,notes text,photo_url text,substitution_preference text,status text);create table shopping_substitutions(id uuid default gen_random_uuid(),delivery_id uuid,customer_approved boolean,shopping_item_id uuid);create table bfm_settings(id int,service_enabled boolean);insert into bfm_settings values(1,true);create table notifications(user_id uuid,title text,body text);create table delivery_status_logs(delivery_id uuid,status text,updated_by uuid);`;
const customer='00000000-0000-4000-8000-000000000001',driver='00000000-0000-4000-8000-000000000002';
const order={tracking_number:'TEST',shop_name:'Shop',shop_address:'Address',shop_lat:53.48,shop_lng:-2.24,delivery_address:'Destination',delivery_lat:53.49,delivery_lng:-2.25,shopping_items:[item],price:10,base_price:10,service_fee:1,max_spend_approved:50};
test('PostgreSQL: booking retry, transaction rollback, receipt replay and cancelled hold',async()=>{const db=new PGlite();await db.exec(fixture);await db.exec(fs.readFileSync('supabase/migrations/20261030195527_batches_1_4_shopping_safety.sql','utf8'));await db.query('insert into wallet_balances values($1,100,now())',[customer]);const book=async(n=3,o=order)=>(await db.query('select book_shopping_order_atomic($1,$2,$3::jsonb) as r',[customer,`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,JSON.stringify(o)])).rows[0].r;const balance=async()=>(await db.query('select balance from wallet_balances')).rows[0].balance;
const first=await book();assert.equal((await book()).id,first.id);assert.equal(Number(await balance()),40);await assert.rejects(()=>book(4));
await db.query("update delivery_requests set driver_id=$2,status='collected',bfm_stage='shopping' where id=$1",[first.id,driver]);const settle=async(total=30,who=driver)=>(await db.query('select settle_shopping_receipt_atomic($1,$2,$3,$4) as r',[first.id,who,'receipt-url',total])).rows[0].r;
await assert.rejects(()=>settle(-10));await assert.rejects(()=>settle(30,customer));await assert.rejects(()=>settle());await db.query("update shopping_items set status='purchased' where delivery_id=$1",[first.id]);await db.query('insert into shopping_substitutions select gen_random_uuid(),$1,null,id from shopping_items where delivery_id=$1',[first.id]);await assert.rejects(()=>settle());await db.query('update shopping_substitutions set customer_approved=true where delivery_id=$1',[first.id]);assert.equal((await settle()).refund,20);assert.equal((await settle()).replayed,true);assert.equal(Number(await balance()),60);await assert.rejects(()=>settle(20));
await db.exec("alter table shopping_items add constraint fail_item check(name<>'ROLLBACK')");await assert.rejects(()=>book(5,{...order,shopping_items:[{...item,name:'ROLLBACK'}]}));assert.equal((await db.query('select count(*) from delivery_requests')).rows[0].count,1);assert.equal(Number(await balance()),60);const next=await book(6);await db.query("update delivery_requests set status='cancelled' where id=$1",[next.id]);await db.query("update delivery_requests set status='cancelled' where id=$1",[next.id]);assert.equal(Number(await balance()),50);assert.equal((await db.query("select has_function_privilege('authenticated','book_shopping_order_atomic(uuid,uuid,jsonb)','execute') as allowed")).rows[0].allowed,false);await db.close();});

function actions(file,names,{user=null,rows={}}={}) {
 const calls=[];const db={from(table){const q={};for(const method of ['select','eq','order','update','insert','upsert','is','in'])q[method]=(...args)=>{calls.push({table,method,args});return q};q.single=q.maybeSingle=async()=>({data:rows[table]??null,error:null});q.then=fn=>fn({data:Array.isArray(rows[table])?rows[table]:[],error:null});return q}};
 const ctx={console,Date,Math,Number,URL,process,createClient:async()=>({auth:{getUser:async()=>({data:{user}})}}),createAdminClient:()=>db,revalidatePath:()=>{},notifyUser:async()=>{},normalizeBfmSettings:checks.normalizeBfmSettings,validateShoppingItems:checks.validateShoppingItems};
 const text=stripTypeScriptTypes(fs.readFileSync(file,'utf8')).replace(/^import .*$/gm,'').replace(/export /g,'');return {api:vm.runInNewContext(text+';({'+names.join(',')+'})',ctx),calls};
}
test('anonymous users cannot read private document/substitution data',async()=>{
 const d=actions('app/actions/documents.ts',['getDriverDocumentsById']);assert.equal((await d.api.getDriverDocumentsById('foreign')).length,0);assert.equal(d.calls.length,0);
 const s=actions('app/actions/shopping.ts',['getShoppingSubstitutions']);assert.ok((await s.api.getShoppingSubstitutions('foreign')).error);assert.equal(s.calls.length,0);
});
test('unrelated user cannot mark a shopping item purchased',async()=>{const s=actions('app/actions/shopping.ts',['markItemFound'],{user:{id:'customer'},rows:{shopping_items:{delivery_id:'job'},delivery_requests:{driver_id:'other-driver',status:'collected',bfm_stage:'shopping'}}});assert.ok((await s.api.markItemFound('item')).error);assert.equal(s.calls.some(c=>c.method==='update'),false)});
test('purchase-completed action cannot bypass receipt settlement',async()=>{const s=actions('app/actions/shopping.ts',['updateBfmStage'],{user:{id:'driver'},rows:{delivery_requests:{driver_id:'driver',service_type:'buy_for_me',status:'collected',bfm_stage:'shopping'}}});assert.ok((await s.api.updateBfmStage('job','purchase_completed')).error);assert.equal(s.calls.some(c=>c.method==='update'),false)});
test('completed order does not reveal current driver location',async()=>{const s=actions('app/actions/tracking.ts',['getDriverLocationForDelivery'],{user:{id:'customer'},rows:{delivery_requests:{customer_id:'customer',driver_id:'driver',status:'delivered'}}});assert.equal((await s.api.getDriverLocationForDelivery('job')).data.location,null);assert.equal(s.calls.some(c=>c.table==='driver_locations'),false)});

const pricingChecks=vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('lib/booking-pricing.ts','utf8')).replace(/export /g,'')+';({DEFAULT_BOOKING_PRICING,calculateDeliveryFare,inServiceArea,validateBookingPricing})');
test('Shopping defaults accept fifteen products and retain a bounded configurable cap',()=>{
 assert.equal(pricingChecks.DEFAULT_BOOKING_PRICING.maxShoppingProducts,15)
 assert.equal(checks.validateShoppingItems(Array.from({length:15},(_,n)=>({...item,name:`Item ${n+1}`}))),null)
 assert.ok(checks.validateShoppingItems(Array.from({length:16},(_,n)=>({...item,name:`Item ${n+1}`}))))
 assert.equal(pricingChecks.validateBookingPricing({...pricingChecks.DEFAULT_BOOKING_PRICING,maxShoppingProducts:50}),true)
 assert.equal(pricingChecks.validateBookingPricing({...pricingChecks.DEFAULT_BOOKING_PRICING,maxShoppingProducts:51}),false)
})
test('Manchester introduction fares preserve fractional mileage and surcharges',()=>{
 const config=pricingChecks.DEFAULT_BOOKING_PRICING;
 for(const [miles,price] of [[0,4.49],[2,4.49],[3,5.69],[4,6.89],[5,8.09],[6,9.29],[8,11.69],[10,14.09],[2.25,4.79],[2.004,4.49],[2.006,4.50]]) assert.equal(pricingChecks.calculateDeliveryFare(miles,config),price);
 assert.equal(pricingChecks.calculateDeliveryFare(3,{...config,vanFee:5},'bulky'),10.69);
 assert.throws(()=>pricingChecks.calculateDeliveryFare(NaN,config));
 assert.equal(pricingChecks.validateBookingPricing({...config,baseFare:-1}),false);
 assert.equal(pricingChecks.inServiceArea(53.4808,-2.2426,10),true);
 assert.equal(pricingChecks.inServiceArea(51.5074,-0.1278,10),false);
 assert.equal(pricingChecks.inServiceArea(NaN,0,0),false);
});
const trackingChecks=vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('lib/tracking-utils.ts','utf8')).replace(/export /g,'')+';({isFreshLocation,goesToDestination})');
test('GPS freshness uses measurement time; shopping stays routed to shop until purchase',()=>{
 const now=Date.now();assert.equal(trackingChecks.isFreshLocation(now-46000,now),false);assert.equal(trackingChecks.isFreshLocation(now-1000,now),true);assert.equal(trackingChecks.isFreshLocation('bad',now),false);
 assert.equal(trackingChecks.goesToDestination('collected','shopping'),false);assert.equal(trackingChecks.goesToDestination('collected','purchase_completed'),true);assert.equal(trackingChecks.goesToDestination('accepted'),false);assert.equal(trackingChecks.goesToDestination('in_transit'),true);
});
test('address errors distinguish session, quota, denial and zero results',async()=>{
 const code=stripTypeScriptTypes(fs.readFileSync('lib/google.ts','utf8')).replace(/export /g,'');
 const api=vm.runInNewContext(code+';({assertGoogleResponse,googlePlacesAutocomplete})',{fetch:async()=>({ok:false,status:401,json:async()=>({error:'Not authenticated'})}),console});
 assert.throws(()=>api.assertGoogleResponse({status:401,ok:false},{}),/session expired/);
 assert.throws(()=>api.assertGoogleResponse({status:429,ok:false},{}),/busy/);
 assert.throws(()=>api.assertGoogleResponse({status:200,ok:true},{status:'REQUEST_DENIED'}),/unavailable/);
 assert.doesNotThrow(()=>api.assertGoogleResponse({status:200,ok:true},{status:'ZERO_RESULTS'}));
 await assert.rejects(()=>api.googlePlacesAutocomplete('Manchester',{}),/session expired/);
});
test('unapproved drivers cannot broadcast arbitrary GPS',async()=>{
 const s=actions('app/actions/tracking.ts',['updateMyLocation'],{user:{id:'customer'},rows:{driver_profiles:{status:'pending'}}});
 assert.ok((await s.api.updateMyLocation({lat:53.4,lng:-2.2,delivery_id:'job'})).error);assert.equal(s.calls.some(c=>c.method==='upsert'),false);
});
test('driver actions reject terminal state mutations and unsuitable vehicles',async()=>{
 const d=actions('app/actions/delivery.ts',['updateDeliveryStatus'],{user:{id:'driver'}});
 for(const status of ['requested','accepted','collected','delivered','anything']) assert.ok((await d.api.updateDeliveryStatus('job',status)).error);
 assert.equal(d.calls.some(c=>c.method==='update'),false);
 const a=actions('app/actions/documents.ts',['submitForReview'],{user:{id:'driver'},rows:{users:{role:'driver'},driver_profiles:{status:'pending'},driver_documents:[],driver_vehicles:[]}});
 assert.ok((await a.api.submitForReview()).error);assert.equal(a.calls.some(c=>c.method==='upsert'),false);
});
test('PostgreSQL: pricing migration, immutable approval decision, monotonic GPS',async()=>{
 const db=new PGlite();await db.exec(fixture);await db.exec(fs.readFileSync('supabase/migrations/20261030195527_batches_1_4_shopping_safety.sql','utf8'));
 await db.exec("create table surge_pricing_settings(id boolean primary key); insert into surge_pricing_settings values(true); create table driver_locations(driver_id uuid primary key,updated_at timestamptz); alter table shopping_substitutions add column customer_responded_at timestamptz");
 await db.exec(fs.readFileSync('supabase/migrations/20261030205108_configurable_booking_prices.sql','utf8'));
 assert.equal((await db.query('select booking_pricing from surge_pricing_settings')).rows[0].booking_pricing.baseFare,4.49);
 await db.query('insert into wallet_balances values($1,100,now())',[customer]);const booking=(await db.query('select book_shopping_order_atomic($1,$2,$3) as r',[customer,'00000000-0000-4000-8000-000000000021',JSON.stringify(order)])).rows[0].r;
 await db.query("update delivery_requests set driver_id=$2,status='collected',bfm_stage='shopping' where id=$1",[booking.id,driver]);
 const sub=(await db.query('insert into shopping_substitutions select gen_random_uuid(),$1,null,id,null from shopping_items where delivery_id=$1 returning id',[booking.id])).rows[0].id;
 await assert.rejects(()=>db.query('select decide_shopping_substitution($1,$2,true)',[sub,driver]));
 await db.query('select decide_shopping_substitution($1,$2,true)',[sub,customer]);await db.query('select decide_shopping_substitution($1,$2,true)',[sub,customer]);await assert.rejects(()=>db.query('select decide_shopping_substitution($1,$2,false)',[sub,customer]));
 await db.query("insert into driver_locations values($1,'2026-10-30T20:00:00Z')",[driver]);await db.query("update driver_locations set updated_at='2026-10-30T19:00:00Z' where driver_id=$1",[driver]);assert.equal(new Date((await db.query('select updated_at from driver_locations')).rows[0].updated_at).toISOString(),'2026-10-30T20:00:00.000Z');
 assert.equal((await db.query("select has_function_privilege('authenticated','decide_shopping_substitution(uuid,uuid,boolean)','execute') as allowed")).rows[0].allowed,false);await db.close();
});


test('PostgreSQL: card checkout, cancellation/refund idempotency, atomic OTP earnings and approved basket',async()=>{
 const db=new PGlite();await db.exec(fixture);
 await db.exec(fs.readFileSync('supabase/migrations/20261030195527_batches_1_4_shopping_safety.sql','utf8'));
 await db.exec(`alter table users add primary key(id);
 alter table payments add column id uuid primary key default gen_random_uuid(),add column stripe_session_id text,add column stripe_payment_intent text,add column paid_at timestamptz,add column created_at timestamptz default now();
 alter table delivery_requests add column item_description text,add column item_photo_urls text[],add column surge_multiplier numeric,add column discount_amount numeric,add column delivered_at timestamptz,add column delivered_image_url text;
 create table surge_pricing_settings(id boolean primary key,updated_at timestamptz);insert into surge_pricing_settings(id) values(true);
 create table driver_locations(driver_id uuid primary key,updated_at timestamptz);
 alter table shopping_substitutions add column customer_responded_at timestamptz,add column suggested_price numeric;
 create table driver_earnings(driver_id uuid,delivery_id uuid unique,amount numeric,commission_amount numeric,status text);
 create table delivery_otps(delivery_id uuid primary key,otp text,attempts int default 0,verified_at timestamptz);
 create table promo_codes(id uuid primary key,active boolean,valid_from timestamptz,valid_until timestamptz,usage_limit_total int,usage_limit_per_user int);
 create table promo_code_redemptions(promo_code_id uuid,user_id uuid,delivery_id uuid,discount_amount numeric);
 create table driver_profiles(id uuid primary key,status text);create table driver_vehicles(driver_id uuid,vehicle_type text);
 create function handle_driver_cancellation() returns trigger language plpgsql as $$ begin if new.status='cancelled' and old.status<>'cancelled' then update wallet_balances set balance=balance+new.price where user_id=new.customer_id; end if; return new; end $$;
 create trigger legacy_driver_refund after update on delivery_requests for each row execute function handle_driver_cancellation();`);
 await db.exec(fs.readFileSync('supabase/migrations/20261030205108_configurable_booking_prices.sql','utf8'));
 await db.exec(fs.readFileSync('supabase/migrations/20261030211100_direct_checkout_and_shopping_operations.sql','utf8'));
 await db.query("insert into users values($1,'customer'),($2,'driver')",[customer,driver]);
 await db.query('insert into wallet_balances values($1,100,now())',[customer]);
 await db.query("insert into driver_profiles values($1,'approved')",[driver]);await db.query("insert into driver_vehicles values($1,'car')",[driver]);
 const draft={...order,service_type:'buy_for_me',pickup_address:order.shop_address,pickup_lat:order.shop_lat,pickup_lng:order.shop_lng,surge_multiplier:1,discount_amount:0,package_size:'medium'};
 const book=async(n,amount=60)=>{
  const id=(await db.query("insert into payments(customer_id,request_key,payment_method,status,amount,stripe_session_id,booking_draft) values($1,$2,'stripe','pending',$3,$4,$5) returning id",[customer,`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,amount,`cs_${n}`,JSON.stringify({...draft,tracking_number:`CARD-${n}`})])).rows[0].id;
  return {id,finish:async(value=amount,session=`cs_${n}`)=>(await db.query('select finalize_direct_checkout($1,$2,$3,$4) r',[id,session,`pi_${n}`,value])).rows[0].r};
 };
 const p=await book(31);assert.equal((await db.query('select count(*) from delivery_requests')).rows[0].count,0);
 await assert.rejects(()=>p.finish(59));await assert.rejects(()=>p.finish(60,'cs_wrong'));
 const first=await p.finish();assert.equal((await p.finish()).id,first.id);assert.equal((await p.finish()).replayed,true);
 assert.equal((await db.query('select count(*) from shopping_items')).rows[0].count,1);
 assert.equal(Number((await db.query('select driver_earning_quote from delivery_requests where id=$1',[first.id])).rows[0].driver_earning_quote),8);
 await assert.rejects(()=>db.query('select cancel_card_order($1,$2)',[first.id,'00000000-0000-4000-8000-000000000099']));
 await db.query('select cancel_card_order($1,$2)',[first.id,customer]);await db.query('select cancel_card_order($1,$2)',[first.id,customer]);
 const refunds=(await db.query('select refund_jobs from payments where id=$1',[p.id])).rows[0].refund_jobs;assert.equal(refunds.length,1);assert.equal(refunds[0].amount,60);
 assert.equal(Number((await db.query('select balance from wallet_balances')).rows[0].balance),100);
 await assert.rejects(()=>db.query("select queue_order_refund($1,'extra',1)",[first.id]));
 const p2=await book(32);const second=await p2.finish();
 await db.query("update delivery_requests set driver_id=$2,status='collected',bfm_stage='shopping',company_card_reference='ic_test',company_card_verified_at=now() where id=$1",[second.id,driver]);
 await assert.rejects(()=>db.query('select prepare_company_purchase($1,$2)',[second.id,driver]));
 await db.query("update shopping_items set status='purchased',confirmed_unit_price=2 where delivery_id=$1",[second.id]);
 await assert.rejects(()=>db.query('select prepare_company_purchase($1,$2)',[second.id,driver]));
 await db.query("insert into shopping_substitutions select gen_random_uuid(),$1,true,id,now(),2 from shopping_items where delivery_id=$1",[second.id]);
 assert.equal(Number((await db.query('select prepare_company_purchase($1,$2) total',[second.id,driver])).rows[0].total),4);
 await assert.rejects(()=>db.query("update shopping_items set quantity=9 where delivery_id=$1",[second.id]));
 await db.query("select settle_shopping_receipt_atomic($1,$2,'receipt',4)",[second.id,driver]);
 assert.equal((await db.query('select refund_jobs from payments where id=$1',[p2.id])).rows[0].refund_jobs[0].amount,46);
 assert.equal(Number((await db.query('select balance from wallet_balances')).rows[0].balance),100);
 await db.query("update delivery_requests set status='in_transit' where id=$1",[second.id]);await db.query("insert into delivery_otps(delivery_id,otp) values($1,'123456')",[second.id]);
 const complete=async(code)=>(await db.query("select complete_order_with_otp($1,$2,$3,'verified-photo') r",[second.id,driver,code])).rows[0].r;
 for(let n=0;n<5;n++)assert.ok((await complete('wrong')).error);
 assert.ok((await complete('123456')).error);assert.equal((await db.query('select count(*) from driver_earnings')).rows[0].count,0);
 await db.query('update delivery_otps set attempts=0 where delivery_id=$1',[second.id]);
 await db.exec("alter table driver_earnings add constraint simulate_failure check(amount<0)");await assert.rejects(()=>complete('123456'));
 assert.equal((await db.query('select status from delivery_requests where id=$1',[second.id])).rows[0].status,'in_transit');
 await db.exec('alter table driver_earnings drop constraint simulate_failure');assert.equal((await complete('123456')).success,true);assert.ok((await complete('123456')).error);
 assert.equal(Number((await db.query('select amount from driver_earnings')).rows[0].amount),8);
 assert.equal((await db.query("select has_function_privilege('authenticated','finalize_direct_checkout(uuid,text,text,numeric)','execute') allowed")).rows[0].allowed,false);
 const reserve=async(n,d=draft,funds=50)=>(await db.query('select reserve_order_checkout($1,$2,$3,$4,$5) id',[customer,`00000000-0000-4000-8000-${String(n).padStart(12,'0')}`,Number(d.price)+Number(d.max_spend_approved??0),JSON.stringify(d),funds])).rows[0].id;
 await assert.rejects(()=>reserve(41,draft,49));const reserved=await reserve(41);assert.equal(await reserve(41),reserved);await assert.rejects(()=>reserve(42));
 const promo='00000000-0000-4000-8000-000000000090';await db.query("insert into promo_codes values($1,true,now()-interval '1 day',null,1,1)",[promo]);
 const discounted={...draft,service_type:'delivery',max_spend_approved:0,price:9,discount_amount:1,promo_code_id:promo,shopping_items:[]};
 const discountedId=await reserve(43,discounted,null);await assert.rejects(()=>reserve(44,discounted,null));
 await db.query("update payments set stripe_session_id='cs_promo' where id=$1",[discountedId]);await db.query("select finalize_direct_checkout($1,'cs_promo','pi_promo',9)",[discountedId]);
 assert.equal((await db.query('select count(*) from promo_code_redemptions')).rows[0].count,1);
 await db.query('select record_order_refund($1,$2,$3,$4)',[p.id,'cancel-order','re_1','succeeded']);await db.query('select record_order_refund($1,$2,$3,$4)',[p.id,'cancel-order','re_1','pending']);
 assert.equal((await db.query('select refund_jobs from payments where id=$1',[p.id])).rows[0].refund_jobs[0].state,'succeeded');
 const config=(await db.query('select booking_pricing from surge_pricing_settings')).rows[0].booking_pricing;
 await assert.rejects(()=>db.query('select save_booking_pricing($1,$2)',[customer,config]));
 const administrator='00000000-0000-4000-8000-000000000003';await db.query("insert into users values($1,'admin')",[administrator]);await db.query('select save_booking_pricing($1,$2)',[administrator,{...config,minimumDriverEarnings:5}]);
 assert.equal((await db.query('select booking_pricing_history from surge_pricing_settings')).rows[0].booking_pricing_history.length,1);
 assert.equal(Number((await db.query('select driver_earning_quote from delivery_requests where id=$1',[second.id])).rows[0].driver_earning_quote),8);
 // Revised checkout does not reserve Issuing money before customer payment.
 await db.exec(fs.readFileSync('supabase/pending-shopping-checkout-products.sql','utf8'));
 assert.equal((await db.query('select booking_pricing from surge_pricing_settings')).rows[0].booking_pricing.maxShoppingProducts,15);
 const beforeCount=Number((await db.query('select count(*) from delivery_requests')).rows[0].count);
 const zeroFunds=await reserve(51,draft,0);assert.equal(await reserve(51,draft,null),zeroFunds);
 assert.equal(Number((await db.query('select count(*) from delivery_requests')).rows[0].count),beforeCount,'unpaid checkout stays out of dispatch');
 const fifteen={...draft,shopping_items:Array.from({length:15},(_,n)=>({...item,name:`Product ${n+1}`,quantity:1,estimated_price:null}))};
 const p15=await reserve(52,fifteen,null);await db.query("update payments set stripe_session_id='cs_15' where id=$1",[p15]);
 const job15=(await db.query("select finalize_direct_checkout($1,'cs_15','pi_15',60) r",[p15])).rows[0].r;
 assert.equal(Number((await db.query('select count(*) from shopping_items where delivery_id=$1',[job15.id])).rows[0].count),15);
 assert.equal((await db.query("select has_function_privilege('authenticated','reserve_company_shopping_card(uuid,uuid,text,numeric)','execute') allowed")).rows[0].allowed,false);
 await assert.rejects(()=>db.query('select reserve_company_shopping_card($1,$2,$3,100)',[job15.id,customer,'ic_test15']));
 await db.query("update delivery_requests set driver_id=$2,status='accepted' where id=$1",[job15.id,driver]);
 await assert.rejects(()=>db.query('select reserve_company_shopping_card($1,$2,$3,49)',[job15.id,administrator,'ic_test15']));
 assert.equal((await db.query('select company_card_reference from delivery_requests where id=$1',[job15.id])).rows[0].company_card_reference,null);
 await db.query('select reserve_company_shopping_card($1,$2,$3,50)',[job15.id,administrator,'ic_test15']);
 await db.query("update payments set stripe_session_id='cs_51' where id=$1",[zeroFunds]);
 const other=(await db.query("select finalize_direct_checkout($1,'cs_51','pi_51',60) r",[zeroFunds])).rows[0].r;
 await db.query("update delivery_requests set driver_id=$2,status='accepted' where id=$1",[other.id,driver]);
 await assert.rejects(()=>db.query('select reserve_company_shopping_card($1,$2,$3,50)',[other.id,administrator,'ic_test51']));
 await db.query('select reserve_company_shopping_card($1,$2,$3,100)',[other.id,administrator,'ic_test51']);
 await db.query('select reserve_company_shopping_card($1,$2,$3,100)',[other.id,administrator,'ic_test51']);
 await assert.rejects(()=>db.query('select prepare_company_purchase($1,$2)',[other.id,driver]),'card reservation alone never permits purchases');
 await db.query('update wallet_balances set balance=200 where user_id=$1',[customer]);
 const legacy=(await db.query('select book_shopping_order_atomic($1,$2,$3) r',[customer,'00000000-0000-4000-8000-000000000053',JSON.stringify({...order,shopping_items:fifteen.shopping_items})])).rows[0].r;
 assert.equal(Number((await db.query('select count(*) from shopping_items where delivery_id=$1',[legacy.id])).rows[0].count),15);
 await assert.rejects(()=>db.query('select book_shopping_order_atomic($1,$2,$3)',[customer,'00000000-0000-4000-8000-000000000054',JSON.stringify({...order,shopping_items:[...fifteen.shopping_items,item]})]));
 await db.close();
});


test('Card receipt reconciles captured, partially captured and pending purchases before disabling card',async()=>{
 const code=stripTypeScriptTypes(fs.readFileSync('lib/payments/company-card.ts','utf8')).replace(/^import .*$/gm,'').replace(/export /g,'');
 let transactions=[],authorizations=[],disabled=0;
 async function* iterate(rows){yield* rows}
 const stripe={issuing:{transactions:{list:()=>iterate(transactions)},authorizations:{list:()=>iterate(authorizations)},cards:{update:async()=>{disabled++}}}};
 const api=vm.runInNewContext(code+';({verifyCompanyReceipt})',{getStripe:()=>stripe,Number,Math});
 await assert.rejects(()=>api.verifyCompanyReceipt('ic_1',4,4));assert.equal(disabled,0);
 authorizations=[{currency:'gbp',approved:true,amount:400,transactions:[]}];await api.verifyCompanyReceipt('ic_1',4,4);assert.equal(disabled,1);
 transactions=[{currency:'gbp',amount:-100}];authorizations[0].transactions=[{type:'capture',amount:-100}];await api.verifyCompanyReceipt('ic_1',4,4);assert.equal(disabled,2);
 await assert.rejects(()=>api.verifyCompanyReceipt('ic_1',4,3));assert.equal(disabled,2);
 transactions=[{currency:'gbp',amount:-400}];authorizations=[];await api.verifyCompanyReceipt('ic_1',4,4);assert.equal(disabled,3);
});
test('Driver earnings retain agreed snapshots and preserve historical rates',()=>{
 const api=vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('lib/driver-earnings.ts','utf8')).replace(/export /g,'')+';({driverEarning})');
 assert.equal(api.driverEarning({price:10,driver_earning_quote:8}),8);assert.equal(api.driverEarning({price:4.49,driver_earning_quote:4.49}),4.49);assert.equal(api.driverEarning({price:10}),7.5);
});
