import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { z } from 'zod'
import { PGlite } from '@electric-sql/pglite'
const driver='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',customer='00000000-0000-4000-8000-000000000003',job='00000000-0000-4000-8000-000000000004',second='00000000-0000-4000-8000-000000000005',vehicle='00000000-0000-4000-8000-000000000006',owner='00000000-0000-4000-8000-000000000007'
const previous=fs.readFileSync('tests/driver-batches-1-2.test.mjs','utf8')
const previousDatabase=vm.runInNewContext(previous.slice(previous.indexOf('async function database()'),previous.indexOf('async function asUser'))+';database',{PGlite,driver,other,customer,job,second,vehicle,migration:fs.readFileSync('supabase/migrations/20261031174911_driver_batches_1_2.sql','utf8')})
const migration=fs.readFileSync('supabase/migrations/20261031191449_admin_batches_1_3.sql','utf8')
async function database(){
 const db=await previousDatabase()
 await db.exec(`alter table users add column created_at timestamp default now(),add column full_name text;
 alter table driver_profiles add column verification_submitted_at timestamptz;
 alter table delivery_requests add column created_at timestamp default now();
 create table customer_profiles(id uuid primary key);
 insert into customer_profiles values('${driver}'),('${customer}');
 insert into users(id,role) values('${owner}','admin');
 create table driver_earnings(amount numeric,commission_amount numeric,created_at timestamp);
 create table surge_pricing_settings(id boolean primary key,master_enabled boolean default false,demand_enabled boolean default true,demand_threshold_ratio numeric default 1.5,demand_multiplier numeric default 1.3,traffic_enabled boolean default true,traffic_threshold_ratio numeric default 1.4,traffic_multiplier numeric default 1.25,max_total_multiplier numeric default 2,booking_pricing jsonb default '{"baseFare":4.49}',operations_history jsonb default '[{"internal":true}]',geocode_rate_buckets jsonb,payout_worker_token uuid,payout_worker_until timestamptz);
 insert into surge_pricing_settings(id) values(true);
 alter table surge_pricing_settings enable row level security;
 create policy "Authenticated can read surge_pricing_settings" on surge_pricing_settings for select to authenticated using(true);
 grant all on surge_pricing_settings to anon,authenticated;
 grant select(operations_history) on surge_pricing_settings to authenticated;
 create table busy_period_rules(multiplier numeric);
 create table disputes(id uuid primary key default gen_random_uuid(),raised_by uuid,delivery_id uuid,issue text,status text check(status in ('open','resolved','rejected')),created_at timestamp default now());
 grant all on all tables in schema public to service_role;
 `)
 try { await db.exec(migration) } catch (error) { await db.close(); throw error }
 return db
}
function compile(file,imports={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText,{exports,require:n=>{if(n==='@/lib/admin-access')return{getAdminActor:async()=>null,runAdminMutation:async(_scope,_event,_entity,work)=>work()};if(n==='@/lib/integration-health')return{recordHealth:async()=>{}};if(n in imports)return imports[n];throw Error('Unmocked '+n)},Number,Math,Date,Intl});return exports}
function action(file,name,vars){const source=ts.createSourceFile(file,fs.readFileSync(file,'utf8'),ts.ScriptTarget.Latest,true);const node=source.statements.find(n=>ts.isFunctionDeclaration(n)&&n.name.text===name);const code=node.getText(source).replace(/^export /,'');return vm.runInNewContext(ts.transpileModule(code,{compilerOptions:{target:ts.ScriptTarget.ES2020}}).outputText+';'+name,{runAdminMutation:async(_scope,_event,_entity,work)=>work(),...vars})}
const validation=compile('lib/admin-pricing-validation.ts',{zod:{z}})
const pricing=compile('lib/pricing.ts')
const validSurge={master_enabled:true,demand_enabled:true,demand_threshold_ratio:1.5,demand_multiplier:1.3,traffic_enabled:true,traffic_threshold_ratio:1.4,traffic_multiplier:1.25,max_total_multiplier:2}

test('Public pricing is readable; internal columns, wildcard reads, writes and admin identity views are blocked',async()=>{
 const db=await database();try{for(const role of ['anon','authenticated']){
  await db.exec('set role '+role)
  assert.equal((await db.query('select booking_pricing,max_total_multiplier from surge_pricing_settings')).rows.length,1)
  for(const query of ['select * from surge_pricing_settings','select operations_history from surge_pricing_settings','select payout_worker_token from surge_pricing_settings','select geocode_rate_buckets from surge_pricing_settings','update surge_pricing_settings set max_total_multiplier=1','select * from admin_customer_accounts','select * from admin_driver_accounts'])await assert.rejects(db.query(query),/permission denied/)
  await db.exec('reset role')
 }}finally{await db.close()}
})
test('Database rejects invalid surge caps, ratios and busy multipliers',async()=>{
 const db=await database();try{
  for(const [field,value] of [['max_total_multiplier',0],['demand_multiplier',-1],['traffic_multiplier',11],['demand_threshold_ratio',0],['traffic_threshold_ratio',0.5]])await assert.rejects(db.query(`update surge_pricing_settings set ${field}=$1`,[value]),/valid_surge_ranges/)
  await assert.rejects(db.query('insert into busy_period_rules values(99)'),/valid_busy_multiplier/)
  await db.query('update surge_pricing_settings set max_total_multiplier=1')
 }finally{await db.close()}
})
test('Admin pricing input rejects NaN, infinity, missing fields and mass-assigned internal settings',()=>{
 assert.equal(validation.surgeSettingsSchema.safeParse(validSurge).success,true)
 for(const change of [{max_total_multiplier:0},{demand_multiplier:NaN},{traffic_multiplier:Infinity},{master_enabled:'true'},{payout_worker_token:'injected'},{operations_history:[]}])assert.equal(validation.surgeSettingsSchema.safeParse({...validSurge,...change}).success,false)
 assert.equal(validation.surgeSettingsSchema.safeParse({}).success,false)
})
test('Busy rules validate times, day, label, bounds and arbitrary fields',()=>{
 const valid={label:'Evening',day_of_week:5,start_time:'22:00',end_time:'02:00',multiplier:1.2,active:true}
 assert.equal(validation.busyPeriodSchema.safeParse(valid).success,true)
 for(const change of [{start_time:'25:00'},{end_time:'22:00:00'},{day_of_week:7},{multiplier:NaN},{multiplier:11},{label:''},{active:'true'},{id:'injected'}])assert.equal(validation.busyPeriodSchema.safeParse({...valid,...change}).success,false)
})
test('Surge can never reduce a fare through an invalid multiplier cap',()=>{
 for(const cap of [0,-1,Infinity,NaN,11])assert.throws(()=>pricing.combineSurgeFactors([{label:'Demand',multiplier:1.3}],cap),/Invalid surge cap/)
 assert.equal(pricing.combineSurgeFactors([{label:'Demand',multiplier:1.3}],1.2).multiplier,1.2)
 assert.equal(pricing.combineSurgeFactors([],2).multiplier,1)
 assert.throws(()=>pricing.combineSurgeFactors([{label:'Bad',multiplier:Infinity}],2),/Invalid surge multiplier/)
})
test('Switching mode preserves both profiles and clears idle driver availability and GPS',async()=>{
 const db=await database();try{
  await db.query('insert into driver_locations(driver_id,lat,lng) values($1,53,-2)',[driver])
  await db.query("select switch_account_mode($1,'customer')",[driver])
  assert.equal((await db.query('select role from users where id=$1',[driver])).rows[0].role,'customer')
  assert.equal((await db.query('select is_online from driver_profiles where id=$1',[driver])).rows[0].is_online,false)
  assert.equal((await db.query('select count(*) n from driver_locations where driver_id=$1',[driver])).rows[0].n,0)
  assert.equal((await db.query('select count(*) n from customer_profiles where id=$1',[driver])).rows[0].n,1)
  await db.query("select switch_account_mode($1,'driver')",[driver])
  assert.equal((await db.query('select status,is_online from driver_profiles where id=$1',[driver])).rows[0].status,'approved')
  assert.equal((await db.query('select is_online from driver_profiles where id=$1',[driver])).rows[0].is_online,false)
 }finally{await db.close()}
})
test('Active deliveries block a customer-mode switch; legacy customer-mode drivers can recover driver mode',async()=>{
 const db=await database();try{
  await db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[driver,job])
  await assert.rejects(db.query("select switch_account_mode($1,'customer')",[driver]),/active_delivery/)
  assert.equal((await db.query('select role from users where id=$1',[driver])).rows[0].role,'driver')
  await db.query("update users set role='customer' where id=$1",[driver])
  await db.query("select switch_account_mode($1,'driver')",[driver])
  assert.equal((await db.query('select driver_id from delivery_requests where id=$1',[job])).rows[0].driver_id,driver)
 }finally{await db.close()}
})
test('Mode switching cannot elevate admin, demote admin or create missing role profiles',async()=>{
 const db=await database();try{
  await assert.rejects(db.query("select switch_account_mode($1,'admin')",[driver]),/invalid_mode/)
  await assert.rejects(db.query("select switch_account_mode($1,'driver')",[owner]),/account_mode_unavailable/)
  await assert.rejects(db.query("select switch_account_mode($1,'driver')",[customer]),/driver_profile_required/)
  await assert.rejects(db.query("select switch_account_mode($1,'customer')",[other]),/customer_profile_required/)
  await db.exec('set role authenticated')
  await assert.rejects(db.query("select switch_account_mode($1,'customer')",[driver]),/permission denied/)
 }finally{await db.close()}
})
test('Customer-mode profiles cannot return online or accept a new driver assignment',async()=>{
 const db=await database();try{
  await db.query("select switch_account_mode($1,'customer')",[driver])
  await assert.rejects(db.query('update driver_profiles set is_online=true where id=$1',[driver]),/driver_mode_required/)
  await assert.rejects(db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[driver,job]),/driver_not_approved/)
 }finally{await db.close()}
})
test('Customer identity and reports include driver-mode customers and historical customers once',async()=>{
 const db=await database();try{
  await db.query('update delivery_requests set customer_id=$1 where id=$2',[other,second])
  const ids=(await db.query('select id from admin_customer_accounts')).rows.map(r=>r.id)
  assert.equal(ids.length,3);for(const id of [driver,customer,other])assert.ok(ids.includes(id))
  const before=(await db.query('select admin_report_snapshot($1) r',[owner])).rows[0].r
  await db.query("select switch_account_mode($1,'customer')",[driver])
  const after=(await db.query('select admin_report_snapshot($1) r',[owner])).rows[0].r
  assert.equal(before.newCustomers,3);assert.equal(after.newCustomers,3)
  assert.equal(after.activeDrivers,before.activeDrivers-1)
  assert.equal((await db.query('select full_name from admin_driver_accounts where id=$1',[driver])).rows.length,1)
 }finally{await db.close()}
})
test('Dispute actions deny non-admins, unsupported transitions, missing rows and stale decisions',async()=>{
 const db=await database();try{
  const id=(await db.query("insert into disputes(raised_by,delivery_id,issue,status) values($1,$2,'Damaged item','open') returning id",[customer,job])).rows[0].id
  let allowed=true;const revalidated=[]
  const admin={from:table=>{assert.equal(table,'disputes');let next,filters={};const q={update:v=>{next=v.status;return q},eq:(key,value)=>{filters[key]=value;return q},select:()=>q,maybeSingle:async()=>({data:(await db.query('update disputes set status=$1 where id=$2 and status=$3 returning id',[next,filters.id,filters.status])).rows[0]??null})};return q}}
  const update=action('app/actions/delivery.ts','adminUpdateDisputeStatus',{requireAdmin:async()=>allowed,createAdminClient:()=>admin,revalidatePath:path=>revalidated.push(path)})
  allowed=false;assert.ok((await update(id,'resolved')).error);allowed=true
  assert.ok((await update(id,'escalated')).error)
  assert.equal((await update(id,'resolved')).success,true)
  assert.ok((await update(id,'rejected')).error)
  assert.ok((await update(second,'resolved')).error)
  assert.ok(revalidated.includes('/dashboard/admin/disputes'))
  assert.equal((await db.query('select count(*) n from disputes where raised_by=$1 and status=$2',[customer,'resolved'])).rows[0].n,1)
 }finally{await db.close()}
})
test('Surge update strips no checks: rejects unexpected keys before writing and reports a missing settings row',async()=>{
 let writes=0;let missing=false;let allowed=true
 const admin={from:()=>{const q={update:value=>{writes++;assert.equal(value.max_total_multiplier,2);return q},eq:()=>q,select:()=>q,single:async()=>({error:missing?{message:'Missing settings'}:null})};return q}}
 const update=action('app/actions/pricing.ts','adminUpdateSurgeSettings',{requireAdmin:async()=>allowed,surgeSettingsSchema:validation.surgeSettingsSchema,createAdminClient:()=>admin,revalidatePath:()=>{},Date})
 assert.ok((await update({...validSurge,payout_worker_token:'bad'})).error);assert.equal(writes,0)
 allowed=false;assert.ok((await update(validSurge)).error);assert.equal(writes,0)
 allowed=true;assert.equal((await update(validSurge)).success,true)
 missing=true;assert.ok((await update(validSurge)).error)
})
test('Switch action returns a useful failure without redirecting when the atomic switch is rejected',async()=>{
 const calls=[];const switchMode=action('app/actions/auth.ts','switchActiveRole',{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}}),createAdminClient:()=>({rpc:async(name,args)=>{calls.push([name,args]);return{error:{message:'active_delivery'}}}}),redirect:()=>{throw Error('Must not redirect')}})
 const result=await switchMode('customer');assert.match(result.error,/Finish your active delivery/);assert.equal(calls[0][0],'switch_account_mode')
})
test('Marketing includes driver-mode customer identities while preserving individual consent and activity',async()=>{
 const now=new Date().toISOString(),old='2020-01-01T00:00:00Z'
 const rows=[{id:driver,full_name:'Dual account',created_at:old,marketing_email_opt_in:false,marketing_push_opt_in:true},{id:customer,full_name:'Customer',created_at:old,marketing_email_opt_in:true,marketing_push_opt_in:false}]
 const admin={rpc:async()=>({data:{[driver]:now,[customer]:old}}),from:table=>{const q={select:()=>q,eq:()=>q,in:()=>q,order:()=>q,range:()=>q,then:resolve=>Promise.resolve({data:table==='admin_customer_accounts'?rows:table==='users'?rows:[{customer_id:driver,created_at:now}]}).then(resolve)};assert.ok(['admin_customer_accounts','users','delivery_requests'].includes(table));return q},auth:{admin:{listUsers:async()=>({data:{users:[{id:driver,email:'driver@example.test'},{id:customer,email:'customer@example.test'}]}})}}}
 const segments=compile('lib/marketing/segments.ts',{'@/lib/auth-directory':{allAuthUsers:async admin=>admin.auth.admin.listUsers({page:1,perPage:1000})}})
 const all=await segments.resolveMarketingRecipients(admin,'all');assert.equal(all.length,2);assert.equal(all[0].marketing_email_opt_in,false);assert.equal(all[0].marketing_push_opt_in,true)
 const inactive=await segments.resolveMarketingRecipients(admin,'inactive',30);assert.equal(inactive.length,1);assert.equal(inactive[0].id,customer)
})
test('An unavailable customer identity query is reported instead of becoming an empty marketing audience',async()=>{
 const segments=compile('lib/marketing/segments.ts',{'@/lib/auth-directory':{allAuthUsers:async admin=>admin.auth.admin.listUsers({page:1,perPage:1000})}})
 await assert.rejects(segments.resolveMarketingRecipients({from:()=>{const q={select:()=>q,eq:()=>q,order:()=>q,range:async()=>({data:null,error:{message:'unavailable'}})};return q}},'all'),/Customer audience could not load/)
})
test('Busy-period creation returns the real database ID and a missing update cannot report success',async()=>{
 const form={label:'Evening',day_of_week:null,start_time:'17:00',end_time:'19:00',multiplier:1.3,active:true}
 let missing=false
 const admin={from:table=>{assert.equal(table,'busy_period_rules');const q={insert:()=>q,update:()=>q,eq:()=>q,select:()=>q,single:async()=>missing?{error:{message:'Not found'}}:{data:{id:job,...form}}};return q}}
 const vars={requireAdmin:async()=>true,busyPeriodSchema:validation.busyPeriodSchema,createAdminClient:()=>admin,revalidatePath:()=>{}}
 const create=action('app/actions/pricing.ts','adminCreateBusyPeriodRule',vars)
 const update=action('app/actions/pricing.ts','adminUpdateBusyPeriodRule',vars)
 assert.equal((await create(form)).data.id,job)
 assert.equal((await update(job,form)).data.id,job)
 missing=true;assert.ok((await update(job,form)).error)
})
