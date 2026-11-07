import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {PGlite} from '@electric-sql/pglite'

const migration=fs.readdirSync('supabase/migrations').find(f=>f.endsWith('_r28_recovery_and_shopping_contact.sql'))
const read=f=>fs.readFileSync(f,'utf8')
const id=n=>'00000000-0000-4000-8000-'+String(n).padStart(12,'0')
const actor=id(1),driver=id(2),customer=id(3),released=id(4),assigned=id(5),postPurchase=id(6),unpaid=id(7)
const jsx=(type,props)=>({type,props})
const nodes=x=>Array.isArray(x)?x.flatMap(nodes):x&&typeof x==='object'?[x,...nodes(x.props?.children)]:[]
function load(path,imports={}){
 const exports={}
 vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,
  {exports,require:n=>n==='react/jsx-runtime'?{jsx,jsxs:jsx}:imports[n]??{},Intl,Date})
 return exports
}

test('Recovery returns paid uncollected jobs to dispatch, resumes assigned jobs and never edits a payment', async()=>{
 const db=new PGlite()
 try{
  await db.exec(`create role anon;create role authenticated;create role service_role;create schema godrop_private;
   create function godrop_private.admin_has_scope(uuid,text) returns boolean language sql as 'select $1=''${actor}''::uuid';
   create table users(id uuid,role text,account_status text);
   create table driver_profiles(id uuid,status text);
   create table delivery_requests(id uuid primary key,customer_id uuid,driver_id uuid,status text,service_type text default 'delivery',recovery_case jsonb,company_card_reference text,purchase_authorized_at timestamptz,purchase_confirmed_at timestamptz,receipt_url text,bfm_stage text,parcel_image_url text,recipient_name text,recipient_phone text,collection_at timestamptz);
   create table payments(delivery_id uuid,customer_id uuid,purpose text,status text,payment_method text,amount numeric,booking_draft jsonb,refund_jobs jsonb default '[]');
   create table notifications(user_id uuid,title text,body text,action_url text);
   create table announced(id uuid);
   create function godrop_private.announce_paid_delivery(uuid,text,uuid default null) returns void language sql as 'insert into announced values ($1)';
   create table audits(event text);
   create function append_admin_audit(uuid,text,text,jsonb) returns void language sql as 'insert into audits values ($2)';
   insert into users values ('${driver}','driver','active');
   insert into driver_profiles values ('${driver}','approved');
   insert into delivery_requests(id,customer_id,driver_id,status,recovery_case,bfm_stage) values
   ('${released}','${customer}',null,'requested','{"status":"open","action":"open"}',null),
   ('${assigned}','${customer}','${driver}','accepted','{"status":"open","action":"return_to_pickup"}',null),
   ('${postPurchase}','${customer}','${driver}','collected','{"status":"open","action":"cancellation_review"}','purchase_completed'),
   ('${unpaid}','${customer}',null,'requested','{"status":"open","action":"safety_release_review"}',null);
   insert into payments(delivery_id,customer_id,purpose,status,payment_method,amount)
   select id,customer_id,'booking',case when id='${unpaid}' then 'pending' else 'paid' end,'stripe',4.49 from delivery_requests;`)
  await db.exec(read('supabase/migrations/'+migration))
  const action=(job,kind,who=actor)=>db.query('select admin_recovery_case($1,$2,$3,$4)',[who,job,kind,'Safety concern checked and cleared'])
  await assert.rejects(action(released,'release_to_drivers',driver),/admin_required/)
  await assert.rejects(action(unpaid,'release_to_drivers'),/release_requires_paid_uncollected_order/)
  await assert.rejects(action(postPurchase,'release_to_drivers'),/cancellation_review_requires_finance/)
  await assert.rejects(action(postPurchase,'resume'),/cancellation_review_requires_finance/)
  await action(released,'release_to_drivers')
  await action(assigned,'resume')
  const rows=(await db.query('select id,status,driver_id,recovery_case from delivery_requests order by id')).rows
  assert.deepEqual(rows.slice(0,2).map(o=>[o.status,o.driver_id,o.recovery_case.action,o.recovery_case.status]),[
    ['requested',null,'release_to_drivers','closed'],['accepted',driver,'resume','closed'],
  ])
  assert.equal(rows[0].recovery_case.customer_fee,0)
  assert.equal((await db.query('select count(*) n from announced')).rows[0].n,1)
  assert.ok((await db.query('select amount,refund_jobs from payments')).rows.every(p=>p.amount==='4.49'&&p.refund_jobs.length===0))
  assert.equal((await db.query("select has_function_privilege('authenticated','admin_recovery_case(uuid,uuid,text,text)','execute') ok")).rows[0].ok,false)

  await db.exec(`create trigger copy_paid_parcel_contact after update of status on payments for each row execute function copy_paid_parcel_contact();
    update delivery_requests set service_type='buy_for_me' where id='${unpaid}';
    update payments set booking_draft='{"service_type":"buy_for_me","recipient_phone":"+447928922369"}' where delivery_id='${unpaid}';`)
  assert.equal((await db.query('select recipient_phone from delivery_requests where id=$1',[unpaid])).rows[0].recipient_phone,null)
  await db.query("update payments set status='paid' where delivery_id=$1",[unpaid])
  assert.deepEqual((await db.query('select recipient_phone,recipient_name,collection_at from delivery_requests where id=$1',[unpaid])).rows[0],{
    recipient_phone:'+447928922369',recipient_name:null,collection_at:null,
  })
 }finally{await db.close()}
})

test('Driver GBP formatting preserves agreed net earnings and the minimum quote',()=>{
 const {driverEarning,formatDriverGBP}=load('lib/driver-earnings.ts')
 assert.equal(formatDriverGBP(driverEarning({price:12,driver_earning_quote:9.6})),'£9.60')
 assert.equal(formatDriverGBP(driverEarning({price:4.49,driver_earning_quote:4.49})),'£4.49')
 assert.equal(formatDriverGBP(0),'£0.00')
 assert.equal(formatDriverGBP(null),'—')
})

test('Terminal map badges win over the missing driver state for both outcomes',()=>{
 const tracking=load('lib/tracking-utils.ts')
 const {LiveTrackingPanel}=load('components/tracking/live-tracking-panel.tsx',{
   'next/dynamic':{default:()=>()=>null},react:{useEffect(){},useMemo:f=>f(),useState:v=>[v,()=>{}],useRef:v=>({current:v})},
   '@/lib/supabase/client':{createClient:()=>({})},'@/hooks/use-tracking-route':{useTrackingRoute:()=>null},'@/lib/tracking-utils':tracking,
 })
 for(const [status,label] of [['delivered','Delivered'],['cancelled','Cancelled']]){
  const tree=LiveTrackingPanel({status,driverId:null,pickup:null,destination:null})
  assert.ok(nodes(tree).some(x=>x.props?.children===label))
  assert.ok(!nodes(tree).some(x=>x.props?.children==='Awaiting driver'))
 }
})

test('Typed or changed shopping addresses must resolve before continuing',()=>{
 const {shoppingAddressProblem}=load('lib/shopping-booking.ts')
 assert.match(shoppingAddressProblem('shop address','Tesco Gorton',null),/Confirm the shop address/)
 assert.match(shoppingAddressProblem('delivery address','',null),/Enter the delivery address/)
 const place={address:'Tesco Gorton',lat:53.4,lng:-2.2}
 assert.equal(shoppingAddressProblem('shop address',place.address,place),'')
 assert.match(shoppingAddressProblem('shop address','A different address',place),/Confirm/)
})

test('A formerly assigned job link returns a useful page without fetching private details',async()=>{
 const filters=[]
 const query={select:()=>query,eq:(...args)=>{filters.push(args);return query},maybeSingle:async()=>({data:null,error:null})}
 const page=load('app/dashboard/driver/jobs/[jobId]/page.tsx',{
   '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})},from:()=>query})},
   '@/app/actions/driver-operations':{getDriverCustomerContact:()=>assert.fail('No contact lookup without assignment')},
   'next/navigation':{notFound:()=>assert.fail('Expected friendly job page')},'next/link':{default:()=>null},
 }).default
 const pageTree=await page({params:Promise.resolve({jobId:released})})
 assert.ok(nodes(pageTree).some(x=>x.props?.children==='This job is no longer assigned to you'))
 assert.ok(nodes(pageTree).some(x=>x.props?.href==='/dashboard/driver/active-jobs'))
 assert.deepEqual(filters,[['id',released],['driver_id',driver]])
})
