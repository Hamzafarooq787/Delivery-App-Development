import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {PGlite} from '@electric-sql/pglite'
const customer='00000000-0000-4000-8000-000000000001',driver='00000000-0000-4000-8000-000000000002',other='00000000-0000-4000-8000-000000000003',job='00000000-0000-4000-8000-000000000005',key='00000000-0000-4000-8000-000000000007'
function compile(file,imports,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{if(n==='@/lib/admin-access')return{getAdminActor:async()=>null,runAdminMutation:async(_scope,_event,_entity,work)=>work()};if(n==='@/lib/integration-health')return{recordHealth:async()=>{}};if(n in imports)return imports[n];throw Error('Unmocked '+n)},console,URL,URLSearchParams,Number,Math,Date,...extra});return exports}
const validation=compile('lib/customer-validation.ts',{})
const summary=compile('lib/shopping-summary.ts',{})
const display=compile('lib/payment-display.ts',{})
const destination=compile('lib/notification-destination.ts',{})
test('Wallet shopping cancellation shows the full actual ledger return; settled refunds are not inferred or double counted',()=>{
 const order={price:9.68,max_spend_approved:50,payment_method:'wallet'}
 const cancelled=summary.shoppingFinancials(order,{amount:9.68,payment_method:'wallet',refund_jobs:[{amount:9.68,state:'succeeded'},{amount:50,state:'succeeded'}]})
 assert.equal(cancelled.charged,59.68);assert.equal(cancelled.returned,59.68);assert.equal(cancelled.retained,0)
 const settled={...order,actual_items_total:32,shopping_hold_settled_at:'settled'}
 assert.equal(summary.shoppingFinancials(settled,{amount:9.68,payment_method:'wallet',refund_jobs:[]}).returned,0)
 const extra=summary.shoppingFinancials(settled,{amount:9.68,payment_method:'wallet',refund_jobs:[{amount:18,state:'succeeded'},{amount:5,state:'succeeded'},{amount:3,state:'pending'}]})
 assert.equal(extra.returned,23);assert.equal(extra.retained,36.68)
})
test('Customer payment states distinguish full, partial and pending refunds without changing accounting state',()=>{
 assert.equal(display.paymentDisplayStatus('paid',59.68,[{amount:59.68,state:'succeeded'}]),'refunded')
 assert.equal(display.paymentDisplayStatus('paid',59.68,[{amount:18,state:'succeeded'}]),'partially_refunded')
 assert.equal(display.paymentDisplayStatus('paid',59.68,[{amount:18,state:'pending'}]),'refund_pending')
 assert.equal(display.paymentDisplayStatus('paid',59.68,[{amount:18,state:'failed'}]),'paid')
})
function trackingFixture(user={id:customer}){const filters=[];let deletes=0;const q={delete(){deletes++;return q},eq(k,v){filters.push([k,v]);return q},then:fn=>Promise.resolve({error:null}).then(fn)};const api=compile('app/actions/tracking.ts',{'@/lib/customer-validation':validation,'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user}})}})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})}});return {api,filters,get deletes(){return deletes}}}
test('Stopping location without an order never deletes another active order location',async()=>{const f=trackingFixture();assert.ok((await f.api.clearCustomerLocation()).error);assert.equal(f.deletes,0);await f.api.clearCustomerLocation(job);assert.equal(f.deletes,1);assert.deepEqual(f.filters,[['customer_id',customer],['delivery_id',job]])})
test('Pre-booking GPS works locally without calling the active-order sharing service',async()=>{
 // Execute the actual form function with GPS and component state mocks.
 const source=ts.createSourceFile('form.tsx',fs.readFileSync('components/customer/NewDeliveryModal.tsx','utf8'),ts.ScriptTarget.Latest,true,ts.ScriptKind.TSX)
 let found;function visit(node){if(ts.isFunctionDeclaration(node)&&node.name?.text==='startLiveLocation')found=node;ts.forEachChild(node,visit)}visit(source);assert.ok(found)
 const vars={liveLocationLoading:false,liveLocationActive:false,liveWatch:{current:null},locationRequests:{current:{live:0}},locationMounted:{current:true},cancelGps:()=>{},setLiveLocationActive:v=>vars.liveLocationActive=v,setLiveLocationLoading:v=>vars.liveLocationLoading=v,setLiveLocationError:()=>{},setUserCoords:v=>vars.position=v,setDeliveryCoords:()=>{},setDeliveryValue:v=>vars.address=v,googleReverseGeocode:async()=>'Manchester',reportLocationIssue:()=>{throw Error('GPS should not be rejected')},navigator:{geolocation:{watchPosition:()=>1,clearWatch:()=>{}}},Date}
 const code=ts.transpileModule(found.getText(source),{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText
 const start=vm.runInNewContext(code+';startLiveLocation',vars)
 await start(false,{coords:{latitude:53.48,longitude:-2.24}});assert.equal(vars.liveLocationActive,true);assert.equal(vars.liveWatch.current,1);assert.equal(vars.position.lat,53.48)
})
test('Order notification links reject external URLs, cross-role routes and appended query payloads',()=>{
 const c='/dashboard/customer/tracking?id='+job,d='/dashboard/driver/jobs/'+job
 assert.equal(destination.notificationDestination(c,'customer'),c);assert.equal(destination.notificationDestination(d,'driver'),d)
 for(const value of ['https://evil.test',c+'&next=//evil.test',d,'//evil.test',c+'#bad'])assert.equal(destination.notificationDestination(value,'customer'),null)
})
async function database(){const db=new PGlite();await db.exec(`create role anon;create role authenticated;create role service_role;
create table users(id uuid primary key,role text);
create table delivery_requests(id uuid primary key,customer_id uuid,driver_id uuid,status text,tracking_number text,service_type text,price numeric,max_spend_approved numeric,shopping_hold_settled_at timestamptz,actual_items_total numeric,order_messages jsonb default '[]');
create table support_tickets(id uuid,user_id uuid,replies jsonb default '[]',status text);
create table payments(id uuid default gen_random_uuid(),delivery_id uuid,status text,created_at timestamptz default now(),payment_method text,amount numeric,refund_jobs jsonb default '[]');
create table wallet_transactions(id uuid default gen_random_uuid(),user_id uuid,delivery_id uuid,type text,amount numeric);
create table notifications(id uuid primary key,user_id uuid,title text,body text,read boolean default false);
`);const previous=fs.readFileSync('supabase/pending-customer-batches-4-10.sql','utf8');await db.exec(previous.slice(previous.indexOf('create or replace function public.append_customer_thread'),previous.indexOf('create or replace function public.customer_payment_records')));await db.exec(fs.readFileSync('supabase/pending-customer-followup-batch.sql','utf8'));await db.query("insert into users values($1,'customer'),($2,'driver'),($3,'customer')",[customer,driver,other]);await db.query("insert into delivery_requests(id,customer_id,driver_id,status,tracking_number,service_type,price,max_spend_approved)values($1,$2,$3,'accepted','GD1','buy_for_me',9.68,50)",[job,customer,driver]);return db}
test('Database commits one recipient notification with a message; retries, strangers and terminal orders cannot duplicate it',async()=>{const db=await database();try{
 const send=(actor=customer,k=key,body='Hello')=>db.query('select send_customer_order_message($1,$2,$3,$4) r',[job,actor,k,body]);await assert.rejects(()=>send(other));assert.equal((await send()).rows[0].r.created,true);assert.equal((await send()).rows[0].r.created,false);await assert.rejects(()=>send(customer,key,'Changed body'));const ns=(await db.query('select * from notifications')).rows;assert.equal(ns.length,1);assert.equal(ns[0].user_id,driver);assert.equal(ns[0].action_url,'/dashboard/driver/jobs/'+job);assert.equal((await db.query('select order_messages from delivery_requests')).rows[0].order_messages.length,1)
 await db.query("update delivery_requests set status='delivered' where id=$1",[job]);await assert.rejects(()=>send(customer,'00000000-0000-4000-8000-000000000009'));assert.equal((await db.query("select has_function_privilege('authenticated','send_customer_order_message(uuid,uuid,uuid,text)','execute') ok")).rows[0].ok,false)
 }finally{await db.close()}})
test('Message and notification roll back together if notification persistence fails',async()=>{const db=await database();try{await db.query("insert into notifications(id,user_id)values($1,$2)",[key,other]);await assert.rejects(()=>db.query('select send_customer_order_message($1,$2,$3,$4)',[job,customer,key,'Hello']));assert.equal((await db.query('select order_messages from delivery_requests')).rows[0].order_messages.length,0)}finally{await db.close()}})
test('SQL payment pages derive refund state while preserving paid status and gross month totals',async()=>{const db=await database();try{await db.query("insert into payments(delivery_id,status,payment_method,amount,refund_jobs)values($1,'paid','stripe',59.68,$2)",[job,JSON.stringify([{amount:59.68,state:'succeeded'}])]);const r=(await db.query('select customer_payment_records($1,1,10,false) r',[customer])).rows[0].r;assert.equal(r.rows[0].status,'refunded');assert.equal(r.rows[0].payment_status,'paid');assert.equal(Number(r.paidMonth),59.68);assert.equal(Number(r.refunds),59.68);assert.equal(Number(r.rows[0].retainedTotal),0);assert.equal((await db.query('select status from payments')).rows[0].status,'paid')}finally{await db.close()}})
test('Wallet paging can request older rows with stable ordering and always scopes the customer',async()=>{let range,filters=[],orders=[];const q={select:()=>q,eq(k,v){filters.push([k,v]);return q},order(k){orders.push(k);return q},range(a,b){range=[a,b];return Promise.resolve({data:[{id:'older'}],count:75,error:null})}};const api=compile('app/actions/wallet.ts',{'@/app/actions/order-checkout':{},'@/lib/payments/direct':{},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:customer}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})}});const r=await api.getWalletTransactions(4,20);assert.deepEqual(range,[60,79]);assert.deepEqual(filters,[['user_id',customer]]);assert.deepEqual(orders,['created_at','id']);assert.equal(r.totalCount,75);assert.equal(r.data[0].id,'older')})
test('Shopping details load only the owner order wallet refunds and feed the same completed totals',async()=>{
 let scoped=[];const order={id:job,service_type:'buy_for_me',payment_method:'wallet',price:9.68,max_spend_approved:50}
 const db={from(table){const q={select:()=>q,eq(k,v){if(table==='wallet_transactions')scoped.push([k,v]);return q},order:()=>q,maybeSingle:async()=>({data:table==='delivery_requests'?order:{amount:9.68,payment_method:'wallet',refund_jobs:[]}}),then:resolve=>Promise.resolve({data:table==='wallet_transactions'?[{id:'fee',amount:9.68},{id:'hold',amount:50}]:[],error:null}).then(resolve)};return q}}
 const api=compile('app/actions/customer-shopping.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:customer}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>db}})
 const r=await api.getCustomerShoppingDetails(job);assert.ok(r.data);assert.deepEqual(scoped,[['user_id',customer],['delivery_id',job],['type','cashback']]);assert.equal(summary.shoppingFinancials(r.data.order,r.data.payment).returned,59.68)
})
test('Message push is deferred only for a newly committed notification; a retry never sends twice',async()=>{
 let scheduled=[],pushes=[];let created=true
 const api=compile('app/actions/customer-repairs.ts',{'next/server':{after:fn=>scheduled.push(fn)},'@/lib/notifications/internal':{notifyUser:async p=>pushes.push(p)},'@/lib/customer-validation':validation,'@/lib/customer-home-data':{},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:customer}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{assert.equal(name,'send_customer_order_message');assert.equal(args.p_actor,customer);return{data:{created,recipient:driver,url:'/dashboard/driver/jobs/'+job}}}})}})
 assert.equal((await api.sendCustomerThread('order',job,key,'Hello')).success,true);assert.equal(scheduled.length,1);assert.equal(pushes.length,0);created=false;await api.sendCustomerThread('order',job,key,'Hello');assert.equal(scheduled.length,1);await scheduled[0]();assert.equal(pushes[0].userId,driver);assert.equal(pushes[0].url,'/dashboard/driver/jobs/'+job)
})
test('Map recenter request refits the real map adapter and satellite selection reaches Google options',()=>{
 let effects=[],renders=0,fit=0;const map={fitBounds:()=>fit++,getZoom:()=>14,panTo:()=>{},setZoom:()=>{}}
 const jsx=(type,props)=>({type,props})
 const api=compile('components/maps/google-live-map.tsx',{'react':{useEffect:(fn,deps)=>effects.push({fn,deps}),useRef:()=>({current:map}),useState:()=>{renders++;return [renders%2===0?true:null,()=>{}]},useCallback:fn=>fn},'react/jsx-runtime':{jsx,jsxs:jsx},'@/components/shared/brand-provider':{useBrand:()=>({brand:'orange'})},'@react-google-maps/api':{GoogleMap:'GoogleMap',Polyline:'Polyline',OverlayView:'OverlayView',useJsApiLoader:()=>({isLoaded:true})}},{process:{env:{}},navigator:{},google:{maps:{LatLngBounds:class{extend(){}},event:{addListenerOnce:()=>{}}}}})
 const props={pickup:{lat:53.48,lng:-2.24},destination:{lat:53.49,lng:-2.25},showUserLocation:false,centreRequest:1,mapType:'satellite'}
 const tree=api.GoogleLiveMap(props);const effect=effects.find(e=>e.deps?.includes(1));assert.ok(effect);effect.fn();assert.equal(fit,1);assert.equal(tree.props.children.props.options.mapTypeId,'satellite');assert.equal(tree.props.children.props.options.styles.length,0)
 effects=[];api.GoogleLiveMap({...props,centreRequest:2});effects.find(e=>e.deps?.includes(2)).fn();assert.equal(fit,2)
})
