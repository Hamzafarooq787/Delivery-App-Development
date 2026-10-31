import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {PGlite} from '@electric-sql/pglite'
const driver='00000000-0000-4000-8000-000000000001',other='00000000-0000-4000-8000-000000000002',customer='00000000-0000-4000-8000-000000000003',job='00000000-0000-4000-8000-000000000004',second='00000000-0000-4000-8000-000000000005',vehicle='00000000-0000-4000-8000-000000000006'
const oldTests=fs.readFileSync('tests/driver-batches-1-2.test.mjs','utf8')
const oldDatabase=vm.runInNewContext(oldTests.slice(oldTests.indexOf('async function database()'),oldTests.indexOf('async function asUser'))+';database',{PGlite,driver,other,customer,job,second,vehicle,migration:fs.readFileSync('supabase/migrations/20261031174911_driver_batches_1_2.sql','utf8')})
const migration=fs.readFileSync('supabase/migrations/20261031181913_driver_batches_3_7.sql','utf8')
async function database(){const db=await oldDatabase();await db.exec(`
 alter table delivery_requests add column price numeric,add column driver_earning_quote numeric,add column pickup_address text,add column tracking_number text,add column created_at timestamptz default now();
 create table driver_earnings(id uuid primary key default gen_random_uuid(),delivery_id uuid unique,driver_id uuid,amount numeric,commission_amount numeric,status text,created_at timestamptz default now());
 create table payouts(id uuid primary key default gen_random_uuid(),driver_id uuid,amount numeric,status text,created_at timestamptz default now(),payment_reference text,provider jsonb);
 create table notifications(id uuid default gen_random_uuid(),user_id uuid,title text,body text,action_url text,created_at timestamptz default now());
 create table surge_pricing_settings(id boolean primary key,booking_pricing jsonb);insert into surge_pricing_settings values(true,'{"waitingPerMinute":1.2}');
 `);await db.exec(migration);return db}
function compile(file,imports,extra={}){const exports={};vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>{if(n==='@/lib/admin-access')return{getAdminActor:async()=>null,runAdminMutation:async(_scope,_event,_entity,work)=>work()};if(n==='@/lib/integration-health')return{recordHealth:async()=>{}};if(n in imports)return imports[n];throw Error('Unmocked '+n)},console,Number,Math,Date,Intl,...extra});return exports}
const compliance=compile('lib/driver-compliance.ts',{})
test('Required documents match bicycle/motor vehicles and reject missing or expired insurance',()=>{
 assert.deepEqual(Array.from(compliance.requiredDriverDocuments([{vehicle_type:'bicycle'}])),['identity','selfie'])
 assert.equal(compliance.driverComplianceReady([{vehicle_type:'bicycle'}],[{document_type:'identity'},{document_type:'selfie'}]),true)
 const documents=['identity','selfie','insurance','vehicle_registration'].map(document_type=>({document_type,expires_on:document_type==='insurance'?'2099-01-01':null}))
 assert.equal(compliance.driverComplianceReady([{vehicle_type:'car'}],documents),true)
 assert.equal(compliance.driverComplianceReady([{vehicle_type:'car'}],documents.map(d=>({...d,expires_on:null}))),false)
 assert.equal(compliance.driverComplianceReady([{vehicle_type:'car'}],documents.map(d=>({...d,expires_on:d.document_type==='insurance'?'2000-01-01':null}))),false)
 assert.equal(compliance.driverComplianceReady([],documents),false)
})
test('Review submission and admin approval require the correct vehicle documents and valid expiry',async()=>{
 const db=await database();try{
  await db.query("insert into users values(gen_random_uuid(),'admin')")
  const admin=(await db.query("select id from users where role='admin'")).rows[0].id
  await db.query("update driver_profiles set status='pending' where id=$1",[driver])
  await assert.rejects(db.query('select submit_driver_verification($1)',[driver]),/complete_valid_documents/)
  await db.query("select save_driver_document($1,'selfie','selfie-url',null)",[driver])
  await db.query("select save_driver_document($1,'vehicle_registration','vehicle-url',null)",[driver])
  await assert.rejects(db.query("select save_driver_document($1,'insurance','policy',null)",[driver]),/valid_expiry/)
  await db.query("select save_driver_document($1,'insurance','policy','2099-01-01')",[driver])
  await db.query('select submit_driver_verification($1)',[driver])
  assert.ok((await db.query('select verification_submitted_at from driver_profiles where id=$1',[driver])).rows[0].verification_submitted_at)
  await assert.rejects(db.query('select approve_driver_verification($1,$2)',[driver,customer]),/admin_required/)
  await db.query('select approve_driver_verification($1,$2)',[driver,admin])
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'approved')
  await db.query("update driver_vehicles set make='New' where id=$1",[vehicle])
  assert.equal((await db.query('select verification_submitted_at from driver_profiles where id=$1',[driver])).rows[0].verification_submitted_at,null)
 }finally{await db.close()}
})
test('Bicycle-only drivers can submit without insurance or registration documents',async()=>{
 const db=await database();try{
  for(const type of ['identity','selfie'])await db.query('select save_driver_document($1,$2,$3,null)',[other,type,type+'-url'])
  await db.query('select submit_driver_verification($1)',[other])
  assert.equal((await db.query('select driver_compliance_ready($1) ready',[other])).rows[0].ready,true)
 }finally{await db.close()}
})
test('Expiry reminders are deduplicated and expired documents block new claims without cancelling active jobs',async()=>{
 const db=await database();try{
  await db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[driver,job])
  // Simulate time passing after the document was originally checked.
  await db.exec('alter table driver_documents disable trigger review_document_change;')
  await db.query("update driver_documents set expires_on=current_date-1 where driver_id=$1",[driver])
  await db.exec('alter table driver_documents enable trigger review_document_change;')
  assert.equal((await db.query('select driver_compliance_reminders() n')).rows[0].n,1)
  assert.equal((await db.query('select driver_compliance_reminders() n')).rows[0].n,0)
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'approved')
  await db.query("update delivery_requests set status='delivered' where id=$1",[job])
  await assert.rejects(db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[driver,second]),/driver_documents_expired/)
  await db.query('select driver_compliance_reminders()')
  assert.equal((await db.query('select status from driver_profiles where id=$1',[driver])).rows[0].status,'pending')
 }finally{await db.close()}
})
test('Finance totals include more than 1000 earnings while rows are paged and isolated to the driver',async()=>{
 const db=await database();try{
  await db.query("insert into driver_earnings(driver_id,amount,commission_amount,status) select $1,8,2,'pending' from generate_series(1,1205)",[driver])
  await db.query("insert into driver_earnings(driver_id,amount,commission_amount,status) values($1,9999,0,'pending')",[other])
  const first=(await db.query("select driver_finance_snapshot($1,1,'all',false) r",[driver])).rows[0].r
  assert.equal(first.count,1205);assert.equal(first.rows.length,20);assert.equal(first.totals.total,9640);assert.equal(first.totals.available,9640)
  const last=(await db.query("select driver_finance_snapshot($1,61,'all',false) r",[driver])).rows[0].r
  assert.equal(last.rows.length,5);assert.equal(last.totals.total,9640)
  await assert.rejects(db.query('select driver_finance_snapshot($1)',[customer]),/driver_required/)
 }finally{await db.close()}
})
test('Legacy earnings are not double-counted; reserved/paid earnings are not available again',async()=>{
 const db=await database();try{
  await db.query("update delivery_requests set driver_id=$1,status='delivered',price=10,driver_earning_quote=8 where id=$2",[driver,job])
  await db.query("insert into driver_earnings(driver_id,delivery_id,amount,commission_amount,status) values($1,$2,8,2,'reserved')",[driver,job])
  await db.query("update delivery_requests set driver_id=$1,status='delivered',price=20,driver_earning_quote=16 where id=$2",[driver,second])
  const r=(await db.query('select driver_finance_snapshot($1) r',[driver])).rows[0].r
  assert.equal(r.totals.total,24);assert.equal(r.totals.available,16);assert.equal(r.count,2)
 }finally{await db.close()}
})
test('London day filters are independent of the database session timezone',async()=>{
 const db=await database();try{
  await db.query("insert into driver_earnings(driver_id,amount,status,created_at) values($1,8,'pending',now())",[driver])
  await db.exec("set timezone='Asia/Karachi'")
  const a=(await db.query("select driver_finance_snapshot($1,1,'day',false) r",[driver])).rows[0].r
  await db.exec("set timezone='America/Los_Angeles'")
  const b=(await db.query("select driver_finance_snapshot($1,1,'day',false) r",[driver])).rows[0].r
  assert.equal(a.count,b.count);assert.equal(a.totals.today,b.totals.today)
 }finally{await db.close()}
})
test('Waiting requests give five free minutes, require customer consent and never debit funds',async()=>{
 const db=await database();try{
  await db.query("update delivery_requests set driver_id=$1,status='accepted',price=10 where id=$2",[driver,job])
  await db.query("select driver_collection_wait($1,$2,'start')",[job,driver])
  await assert.rejects(db.query("select driver_collection_wait($1,$2,'request')",[job,driver]),/free_wait/)
  await db.query("update delivery_requests set collection_wait=jsonb_build_object('started_at',now()-interval '8 minutes','status','timing') where id=$1",[job])
  const r=(await db.query("select driver_collection_wait($1,$2,'request') r",[job,driver])).rows[0].r
  assert.equal(r.amount,3.6);assert.equal(r.status,'awaiting_customer')
  await assert.rejects(db.query("select driver_collection_wait($1,$2,'approve')",[job,other]),/not_allowed/)
  assert.equal((await db.query("select driver_collection_wait($1,$2,'approve') r",[job,customer])).rows[0].r.status,'approved_for_review')
  assert.equal((await db.query('select price from delivery_requests where id=$1',[job])).rows[0].price,'10')
  assert.equal((await db.query('select count(*) n from driver_earnings')).rows[0].n,0)
  await db.query("update delivery_requests set service_type='buy_for_me' where id=$1",[job])
  await assert.rejects(db.query("select driver_collection_wait($1,$2,'start')",[job,driver]),/unavailable/)
 }finally{await db.close()}
})
test('Finance and bank status actions use the signed-in driver; unready accounts are reported honestly',async()=>{
 for(const state of ['not_connected','action_required','ready']){
  const calls=[]
  const q=table=>({select(){return this},eq(k,v){calls.push([table,k,v]);return this},maybeSingle:async()=>({data:{stripe_connect_account_id:state==='not_connected'?null:'acct_test'},error:null}),single:async()=>({data:{automatic_payouts:false},error:null})})
  const admin={from:q,rpc:async(name,input)=>{calls.push([name,input]);return {data:{rows:[]}}}}
  const capability={status:state==='ready'?'active':'pending'}
  const stripe={v2:{core:{accounts:{retrieve:async()=>({configuration:{recipient:{capabilities:{stripe_balance:{stripe_transfers:capability,payouts:capability}}}}})}}}}
  const api=compile('app/actions/driver-operations.ts',{
   '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}})},
   '@/lib/supabase/admin':{createAdminClient:()=>admin},
   'next/cache':{},'@/lib/stripe/server':{getStripe:()=>stripe}
  })
  assert.equal((await api.getDriverBankStatus()).state,state)
  await api.getDriverFinance(999999999,'injected',true)
  const rpc=calls.find(c=>c[0]==='driver_finance_snapshot')[1]
  assert.equal(rpc.p_driver,driver);assert.equal(rpc.p_page,1000000);assert.equal(rpc.p_period,'all')
 }
})

const nodes=n=>!n||typeof n!=='object'?[]:[n,...[n.props?.children].flat(Infinity).flatMap(nodes)]
const label=n=>typeof n==='string'?n:!n||typeof n!=='object'?'':[n.props?.children].flat(Infinity).map(label).join(' ')
test('Verification component shows draft state and enables submission only for all current required files',()=>{
 const jsx=(type,props)=>({type,props})
 const api=compile('components/driver/verification-panel.tsx',{
  react:{useState:v=>[v,()=>{}],useRef:()=>({current:{}}),useTransition:()=>[false,()=>{}],useEffect:()=>{}},
  'react/jsx-runtime':{jsx,jsxs:jsx},'@/lib/supabase/client':{},'@/app/actions/documents':{},'@/components/driver/vehicle-manager':{},'@/lib/driver-compliance':compliance,
 })
 const documents=['identity','selfie','insurance','vehicle_registration'].map(document_type=>({document_type,file_url:'https://example.test/file',expires_on:document_type==='insurance'?'2099-01-01':null}))
 const render=(docs,vehicleType='car')=>api.VerificationPanel({driverStatus:'pending',documents:docs,vehicles:[{vehicle_type:vehicleType}],userId:driver,submittedAt:null})
 assert.ok(label(render([])).includes('Draft — not submitted'))
 assert.ok(!nodes(render(documents.slice(0,1))).some(n=>n.type==='button'&&label(n).includes('Submit for Review')))
 assert.ok(nodes(render(documents)).some(n=>n.type==='button'&&label(n).includes('Submit for Review')))
 const bike=render(documents.slice(0,2),'bicycle')
 assert.ok(!label(bike).includes('Insurance Policy'))
 assert.ok(nodes(bike).some(n=>n.type==='button'&&label(n).includes('Submit for Review')))
})

test('Support creation returns the stored ticket ID and scopes it to the signed-in user',async()=>{
 let inserted
 const saved={id:job,subject:'Help',message:'Need help',status:'open',created_at:'2026-10-31T00:00:00Z'}
 const q={insert:r=>{inserted=r;return q},select:()=>q,single:async()=>({data:saved,error:null})}
 const api=compile('app/actions/driver.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},'next/cache':{revalidatePath:()=>{}}})
 const form=new FormData();form.set('subject','Help');form.set('message','Need help')
 const result=await api.createSupportTicket(form)
 assert.equal(result.data.id,job);assert.equal(inserted.user_id,driver)
})
