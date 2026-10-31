import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'

const driver='00000000-0000-4000-8000-000000000001'
const other='00000000-0000-4000-8000-000000000002'
const customer='00000000-0000-4000-8000-000000000003'
const job='00000000-0000-4000-8000-000000000004'
const second='00000000-0000-4000-8000-000000000005'
const vehicle='00000000-0000-4000-8000-000000000006'
const migration=fs.readFileSync('supabase/migrations/20261031174911_driver_batches_1_2.sql','utf8')

async function database(){
 const db=new PGlite()
 await db.exec(`create role anon; create role authenticated; create role service_role;
 create schema auth; create function auth.uid() returns uuid language sql as $$select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid$$;
 create schema storage; create table storage.objects(name text,bucket_id text,primary key(bucket_id,name));
 create table users(id uuid primary key,role text);
 create table driver_profiles(id uuid primary key,status text,is_online boolean default false);
 create table driver_vehicles(id uuid primary key default gen_random_uuid(),driver_id uuid,vehicle_type text,make text,updated_at timestamptz);
 create table driver_documents(id uuid primary key default gen_random_uuid(),driver_id uuid,document_type text,file_url text check(file_url<>'bad-url'));
 create table delivery_requests(id uuid primary key,customer_id uuid,driver_id uuid,status text,package_size text,company_card_reference text,service_type text default 'delivery',bfm_stage text,receipt_url text,purchase_confirmed_at timestamptz,delivered_at timestamptz,delivered_image_url text);
 create table payments(delivery_id uuid,status text);
 create table driver_locations(driver_id uuid primary key,delivery_id uuid,lat double precision,lng double precision,heading double precision,speed double precision,accuracy double precision,updated_at timestamptz);
 create table delivery_otps(delivery_id uuid primary key,otp text,attempts int default 0,verified_at timestamptz);
 create table delivery_status_logs(delivery_id uuid,status text,updated_by uuid);
 alter table storage.objects enable row level security;
 create policy "Driver can delete own documents" on storage.objects for delete to authenticated using(true);
 create policy "Driver can update own documents" on storage.objects for update to authenticated using(true);
 create policy "owner reads" on storage.objects for select to authenticated using(split_part(name,'/',1)=auth.uid()::text);
 create policy "owner uploads" on storage.objects for insert to authenticated with check(split_part(name,'/',1)=auth.uid()::text);
 alter table delivery_requests enable row level security;
 create policy "Drivers can view open delivery requests" on delivery_requests for select to authenticated using(status='requested');
 create policy assigned on delivery_requests for select to authenticated using(driver_id=auth.uid());
 create policy owned on delivery_requests for select to authenticated using(customer_id=auth.uid());
 alter table driver_locations enable row level security;
 create policy "drivers manage own location" on driver_locations for all to authenticated using(driver_id=auth.uid()) with check(driver_id=auth.uid());
 grant usage on schema public,auth,storage to authenticated,service_role;
 grant select,insert,update,delete on all tables in schema public,storage to authenticated;
 create function guard_driver_assignment() returns trigger language plpgsql as $$begin return new;end$$;
 create trigger guard_driver_assignment before update on delivery_requests for each row execute function guard_driver_assignment();
 insert into users values('${driver}','driver'),('${other}','driver'),('${customer}','customer');
 insert into driver_profiles values('${driver}','pending',false),('${other}','pending',false);
 insert into driver_vehicles(id,driver_id,vehicle_type,make) values('${vehicle}','${driver}','car','Original'),(gen_random_uuid(),'${other}','bicycle','Bike');
 insert into driver_documents(driver_id,document_type,file_url) values('${driver}','identity','old-url');
 update driver_profiles set status='approved',is_online=true;
 insert into delivery_requests(id,customer_id,status,package_size) values('${job}','${customer}','requested','small'),('${second}','${customer}','requested','small');
 insert into payments values('${job}','paid'),('${second}','paid');`)
 await db.exec(migration)
 return db
}
async function asUser(db,id,fn){
 await db.exec(`set role authenticated;set request.jwt.claim.sub='${id}';`)
 try{return await fn()}finally{await db.exec('reset role;')}
}
const claim=(db,id=job,who=driver)=>db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[who,id])

test('Open job rows stay private; assigned drivers and owning customers retain access',async()=>{
 const db=await database();try{
  await asUser(db,driver,async()=>assert.equal((await db.query('select * from delivery_requests')).rows.length,0))
  await claim(db)
  await asUser(db,driver,async()=>assert.deepEqual((await db.query('select id from delivery_requests')).rows.map(r=>r.id),[job]))
  await asUser(db,other,async()=>assert.equal((await db.query('select * from delivery_requests')).rows.length,0))
  await asUser(db,customer,async()=>assert.equal((await db.query('select * from delivery_requests')).rows.length,2))
 }finally{await db.close()}
})

test('Authenticated drivers cannot delete/replace evidence or bypass document, vehicle and GPS actions',async()=>{
 const db=await database();try{
  const path=`${driver}/delivered-${job}-1.jpg`
  await asUser(db,driver,async()=>{
   await db.query("insert into storage.objects values($1,'driver-documents')",[path])
   assert.equal((await db.query("delete from storage.objects where name=$1 returning name",[path])).rows.length,0)
   assert.equal((await db.query("update storage.objects set name='changed' where name=$1 returning name",[path])).rows.length,0)
   assert.equal((await db.query('select * from storage.objects')).rows.length,1)
   for(const sql of ["delete from driver_vehicles","insert into driver_documents(driver_id,document_type,file_url) values('"+driver+"','selfie','fake')","update driver_locations set lat=0","select replace_driver_document('"+driver+"','selfie','fake')"]){await assert.rejects(db.query(sql),/permission denied/)}
   await db.query("insert into storage.objects values($1,'driver-documents')",[`${driver}/identity-new.jpg`])
  })
 }finally{await db.close()}
})

test('Changed vehicles trigger re-review; no-op saves preserve approval',async()=>{
 const db=await database();try{
  await db.query('update driver_vehicles set updated_at=now() where id=$1',[vehicle])
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'approved')
  await db.query("update driver_vehicles set vehicle_type='van' where id=$1",[vehicle])
  assert.deepEqual((await db.query('select status,is_online from driver_profiles where id=$1',[driver])).rows[0],{status:'pending',is_online:false})
  await assert.rejects(claim(db),/driver_not_approved/)
 }finally{await db.close()}
})

test('Atomic document replacement keeps old evidence and approval when replacement fails',async()=>{
 const db=await database();try{
  await assert.rejects(db.query("select replace_driver_document($1,'identity','bad-url')",[driver]),/check constraint/)
  assert.equal((await db.query('select file_url from driver_documents where driver_id=$1',[driver])).rows[0].file_url,'old-url')
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'approved')
  await db.query("select replace_driver_document($1,'identity','new-url')",[driver])
  assert.deepEqual((await db.query('select file_url from driver_documents where driver_id=$1',[driver])).rows.map(r=>r.file_url),['new-url'])
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'pending')
 }finally{await db.close()}
})

test('Active jobs block compliance changes without locking the driver out of that job',async()=>{
 const db=await database();try{
  await claim(db)
  await assert.rejects(db.query("update driver_vehicles set make='Changed' where id=$1",[vehicle]),/finish_active_job/)
  await assert.rejects(db.query("select replace_driver_document($1,'identity','new-url')",[driver]),/finish_active_job/)
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'approved')
  assert.equal((await db.query('select file_url from driver_documents where driver_id=$1',[driver])).rows[0].file_url,'old-url')
 }finally{await db.close()}
})

test('Two job claims cannot give one driver a second active job; another driver can accept it',async()=>{
 const db=await database();try{
  const results=await Promise.allSettled([claim(db),claim(db,second)])
  assert.equal(results.filter(r=>r.status==='fulfilled').length,1)
  assert.match(results.find(r=>r.status==='rejected').reason.message,/driver_has_active_job/)
  const remaining=(await db.query("select id from delivery_requests where status='requested'")).rows[0].id
  await claim(db,remaining,other)
  assert.equal((await db.query("select * from delivery_requests where status='accepted'")).rows.length,2)
 }finally{await db.close()}
})

test('Unpaid jobs and mismatched vehicles cannot be assigned',async()=>{
 const db=await database();try{
  await db.query('delete from payments where delivery_id=$1',[job])
  await assert.rejects(claim(db),/confirmed_payment_required/)
  await db.query("update delivery_requests set package_size='bulky' where id=$1",[second])
  await assert.rejects(claim(db,second),/suitable_vehicle_required/)
 }finally{await db.close()}
})

test('GPS rejects foreign, stale and closed jobs; delayed pings cannot replace newer coordinates',async()=>{
 const db=await database();try{
  await claim(db)
  const publish=(id,who,at,lat)=>db.query('select publish_driver_location($1,$2,$3,-2.2,$4) ok',[who,id,lat,at])
  await assert.rejects(publish(job,other,new Date().toISOString(),53),/active_assigned_job_required/)
  await assert.rejects(publish(job,driver,new Date(Date.now()-60000).toISOString(),53),/fresh_gps_required/)
  const now=new Date().toISOString()
  assert.equal((await publish(job,driver,now,53.5)).rows[0].ok,true)
  assert.equal((await publish(job,driver,new Date(Date.parse(now)-1000).toISOString(),53)).rows[0].ok,false)
  assert.equal((await db.query('select lat from driver_locations')).rows[0].lat,53.5)
  await db.query("update delivery_requests set status='cancelled' where id=$1",[job])
  await assert.rejects(publish(job,driver,new Date().toISOString(),53),/active_assigned_job_required/)
 }finally{await db.close()}
})

test('Shopping completion requires receipt and final stage, verifies OTP once and clears only its GPS',async()=>{
 const db=await database();try{
  await claim(db)
  await db.query("update delivery_requests set service_type='buy_for_me',status='in_transit',bfm_stage='shopping' where id=$1",[job])
  await db.query("insert into delivery_otps(delivery_id,otp) values($1,'1234')",[job])
  const complete=(code='1234',who=driver)=>db.query('select complete_order_with_otp($1,$2,$3,\'proof\') r',[job,who,code])
  assert.ok((await complete()).rows[0].r.error)
  await db.query("update delivery_requests set bfm_stage='heading_to_customer',receipt_url='receipt',purchase_confirmed_at=now() where id=$1",[job])
  assert.ok((await complete('1234',other)).rows[0].r.error)
  assert.equal((await complete('0000')).rows[0].r.attemptsRemaining,4)
  await db.query('select publish_driver_location($1,$2,53.5,-2.2,now())',[driver,job])
  assert.equal((await complete()).rows[0].r.success,true)
  assert.equal((await complete()).rows[0].r.success,true)
  assert.equal((await db.query('select bfm_stage from delivery_requests where id=$1',[job])).rows[0].bfm_stage,'delivered')
  assert.equal((await db.query('select * from driver_locations')).rows.length,0)
  assert.equal((await db.query("select * from delivery_status_logs where status='delivered'")).rows.length,1)
 }finally{await db.close()}
})

function compile(file,imports,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{if(n==='@/lib/admin-access')return{getAdminActor:async()=>null,runAdminMutation:async(_scope,_event,_entity,work)=>work()};if(n==='@/lib/integration-health')return{recordHealth:async()=>{}};if(n in imports)return imports[n];throw Error('Unmocked '+n)},console,Number,Math,Date,...extra});return exports}
function elements(node){if(!node||typeof node!=='object')return[];return[node,...[node.props?.children].flat(Infinity).flatMap(elements)]}
test('Actual Buy for Me final button opens OTP, while closed orders have no advance button',()=>{
 for(const status of ['in_transit','delivered','cancelled']){
  const state=[];let slot=0
  const jsx=(type,props)=>({type,props})
  const react={useState:initial=>{const i=slot++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=v}]},useEffect:()=>{},useTransition:()=>[false,()=>{}]}
  const OtpModal=()=>null
  const component=compile('components/driver/bfm-shopping-workflow.tsx',{'@/lib/order-media':{},'@/components/shared/customer-thread':{},'next/dynamic':{default:()=>()=>null},'@/app/actions/shopping-operations':{},react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{useRouter:()=>({})},sonner:{toast:{}},'@/lib/supabase/client':{},'@/app/actions/shopping':{},'./delivery-otp-modal':{DeliveryOtpModal:OtpModal}})
  const props={job:{id:job,status,bfm_stage:'heading_to_customer'},userId:driver}
  const tree=component.BfmShoppingWorkflow(props)
  const button=elements(tree).find(n=>n.type==='button'&&n.props.children==='Deliver to Customer')
  if(status==='in_transit'){assert.ok(button);assert.equal(button.props.disabled,false);button.props.onClick();slot=0;assert.ok(elements(component.BfmShoppingWorkflow(props)).some(n=>n.type===OtpModal))}
  else assert.equal(button,undefined)
 }
})

test('Shopping stage updates compare driver, main status and previous shopping stage',async()=>{
 const filters=[];let wrote=false
 const row={id:job,driver_id:driver,service_type:'buy_for_me',status:'accepted',bfm_stage:'heading_to_shop'}
 const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},is:(k,v)=>{filters.push([k,v]);return q},single:async()=>({data:row}),update:()=>{wrote=true;return q},then:resolve=>resolve({data:[],error:null})}
 const module=compile('app/actions/shopping.ts',{'@/lib/order-photo-lifecycle':{},'@/lib/order-media':{},'@/lib/payments/company-card':{},'@/lib/payments/direct':{},'@/lib/quote-consent':{},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},'next/cache':{},'@/lib/notifications/internal':{},'@/app/actions/booking-settings':{},'@/app/actions/pricing':{},'@/lib/shopping-validation':{}})
 const result=await module.updateBfmStage(job,'arrived_at_shop')
 assert.equal(wrote,true);assert.ok(result.error)
 for(const filter of [['driver_id',driver],['status','accepted'],['bfm_stage','heading_to_shop']])assert.ok(filters.some(f=>f[0]===filter[0]&&f[1]===filter[1]))
})

test('Legacy multi-job GPS follows the displayed owned job and rejects a foreign UI selection',async()=>{
 for(const [path,selected,expected] of [
  ['/dashboard/driver',second,second],
  [`/dashboard/driver/jobs/${job}`,second,job],
  ['/dashboard/driver',customer,job],
 ]){
  const state=[];let slot=0;const effects=[]
  const jsx=(type,props)=>({type,props})
  const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,limit:async()=>({data:[{id:job},{id:second}],error:null})}
  const channel={on:()=>channel,subscribe:()=>channel}
  const client={from:()=>q,channel:()=>channel,removeChannel:()=>{}}
  const react={useState:initial=>{const i=slot++;if(!(i in state))state[i]=initial;return[state[i],v=>{state[i]=v}]},useMemo:f=>f(),useEffect:f=>effects.push(f)}
  const Broadcaster=()=>null
  const component=compile('components/tracking/driver-active-tracking.tsx',{react,'react/jsx-runtime':{jsx,jsxs:jsx},'next/navigation':{usePathname:()=>path},'@/lib/supabase/client':{createClient:()=>client},'./driver-location-broadcaster':{DriverLocationBroadcaster:Broadcaster},'./driver-tracking-selection':{useDriverTrackingSelection:()=>({deliveryId:selected})}},{setInterval:()=>1,clearInterval:()=>{}})
  component.DriverActiveTracking({userId:driver})
  const cleanups=effects.map(f=>f())
  await new Promise(resolve=>setImmediate(resolve))
  slot=0
  const tree=component.DriverActiveTracking({userId:driver})
  assert.equal(elements(tree).find(n=>n.type===Broadcaster).props.deliveryId,expected)
  cleanups.forEach(f=>f?.())
 }
})
