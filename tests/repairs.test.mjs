import test from 'node:test';import assert from 'node:assert/strict';import fs from 'node:fs';import vm from 'node:vm';import {stripTypeScriptTypes} from 'node:module';import {PGlite} from '@electric-sql/pglite';
const checks=vm.runInNewContext(stripTypeScriptTypes(fs.readFileSync('lib/shopping-validation.ts','utf8')).replace(/export /g,'')+';({validateShoppingItems,normalizeBfmSettings})');
const item={name:'Milk',quantity:2,estimated_price:1.5,substitution_preference:'contact_me'};
test('reject invalid shopping input and normalize enabled settings',()=>{assert.equal(checks.validateShoppingItems([item]),null);for(const v of [[],Array(6).fill(item),[{...item,quantity:-1}],[{...item,quantity:1.5}],[{...item,estimated_price:NaN}],[{...item,estimated_price:-1}]])assert.ok(checks.validateShoppingItems(v));assert.equal(checks.normalizeBfmSettings({service_enabled:true,max_purchase_amount:50,service_fee_percentage:10}).enabled,true);assert.equal(checks.normalizeBfmSettings({enabled:false,service_enabled:true,max_purchase_amount:50,service_fee_percentage:10}).enabled,false)});
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
