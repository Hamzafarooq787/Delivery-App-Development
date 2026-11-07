import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import { PGlite } from '@electric-sql/pglite'

const job='00000000-0000-4000-8000-000000000021', driver='00000000-0000-4000-8000-000000000022'
const read = path => fs.readFileSync(path,'utf8')
function compile(file, imports={}, context={}) {
  const exports={}
  vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>imports[n]??{},Date,AbortSignal,...context})
  return exports
}
const utils=compile('lib/tracking-utils.ts')
const position = timestamp => ({ timestamp, coords:{latitude:53.4609045,longitude:-2.1730057,accuracy:499240.739,heading:null,speed:null} })

test('A coarse measurement is published; an equal or older repeat is a successful no-op',async()=>{
  const calls=[]
  const db={from:()=>({select:()=>({eq:()=>({maybeSingle:async()=>({data:{status:'approved'}})})})}),rpc:async(_,payload)=>{calls.push(payload);return{data:calls.length===1,error:null}}}
  const api=compile('app/actions/tracking.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>db}})
  const args={lat:53.46,lng:-2.17,accuracy:499240.739,delivery_id:job,measured_at:new Date().toISOString()}
  assert.equal((await api.updateMyLocation(args)).ok,true)
  const duplicate=await api.updateMyLocation(args)
  assert.equal(duplicate.ok,true)
  assert.equal(duplicate.unchanged,true)
  assert.equal(calls[0].p_accuracy,499240.739)
  assert.match((await api.updateMyLocation({...args,measured_at:new Date(Date.now()-60000).toISOString()})).error,/fresh/)
  assert.equal(calls.length,2)
})

test('Milestone retries once and permits progress with a clear warning when GPS fails',async()=>{
  let attempts=0,warning='',allowed=true,available=false,uploads=0
  const helper=compile('lib/driver-milestone-location.ts',{
    '@/lib/tracking-utils':utils,'@/lib/short-request':{shortRequest:work=>work},'@/lib/driver-location-permission':{canRequestDriverLocation:async()=>true},
    '@/app/actions/tracking':{updateMyLocation:async p=>{uploads++;assert.equal(p.accuracy,499240.739);return{ok:true}}},
  },{navigator:{onLine:true,geolocation:{getCurrentPosition(ok,error,options){attempts++;assert.equal(options.enableHighAccuracy,false);if(available)ok(position(Date.now()));else error({code:3})}}},window:{confirm:m=>{warning=m;return allowed}}})
  assert.equal(await helper.confirmDriverMilestone(job,'Start travel?'),true)
  assert.match(warning,/continue without a location/)
  assert.equal(attempts,1)
  assert.equal(uploads,0)
  allowed=false
  assert.equal(await helper.confirmDriverMilestone(job,'Arrived?'),false)
  available=true;allowed=true
  assert.equal(await helper.confirmDriverMilestone(job,'Arrived?'),true)
  assert.equal(warning,'Arrived?')
  assert.equal(uploads,1)
  assert.equal(await helper.confirmDriverMilestone(job,'Next?'),true)
  assert.equal(attempts,3)
})

test('The GPS watcher retains the last fresh fix after a duplicate or temporary error',async()=>{
  let success,error,time=Date.now(),writes=0,index=0
  const state=[],effects=[]
  const React={useState:v=>{const slot=index++;state[slot]??=v;return [state[slot],next=>{state[slot]=next}]},useEffect:f=>effects.push(f)}
  const Clock=class extends Date {static now(){return time}}
  const helper=compile('lib/driver-milestone-location.ts',{'@/lib/tracking-utils':utils})
  const jsx={jsx:(type,props)=>({type,props}),jsxs:(type,props)=>({type,props})}
  const {DriverLocationBroadcaster}=compile('components/tracking/driver-location-broadcaster.tsx',{
    react:React,'react/jsx-runtime':jsx,'@/lib/tracking-utils':utils,'@/lib/driver-milestone-location':helper,
    '@/lib/driver-location-permission':{canRequestDriverLocation:async()=>true,rememberDriverLocationDenial(){}},
    '@/lib/short-request':{shortRequest:work=>work},'@/app/actions/tracking':{updateMyLocation:async()=>{writes++;return {ok:true}}},
  },{Date:Clock,setInterval:()=>1,clearInterval(){},navigator:{onLine:true,geolocation:{watchPosition(a,b){success=a;error=b;return 1},clearWatch(){}}},document:{visibilityState:'visible',addEventListener(){},removeEventListener(){}},window:{addEventListener(){},removeEventListener(){}}})
  DriverLocationBroadcaster({deliveryId:job})
  const cleanup=effects.map(effect=>effect())
  await new Promise(resolve => setImmediate(resolve))
  const first=time
  await success(position(first))
  assert.equal(state[0],'sharing')
  time+=8000
  await success(position(first))
  error({code:3})
  assert.equal(writes,1)
  assert.equal(state[0],'sharing')
  error({code:1})
  assert.equal(state[0],'denied')
  cleanup.forEach(fn=>fn?.())
})

test('Database audits milestones without GPS and preserves a fresh fix without recording coordinates in the audit',async()=>{
  const db=new PGlite()
  try {
    await db.exec(`create role anon;create role authenticated;
      create table delivery_requests(id uuid,driver_id uuid,status text,accepted_at timestamptz,travel_started_at timestamptz,arrived_at timestamptz,purchased_at timestamptz);
      create table driver_locations(driver_id uuid,delivery_id uuid,updated_at timestamp);
      create table admin_audit_log(actor_id uuid,event text,entity text,details jsonb,created_at timestamptz);
      insert into delivery_requests values ('${job}','${driver}','accepted',now(),null,null,null);
    `)
    const migration=fs.readdirSync('supabase/migrations').find(path=>path.endsWith('_audit_driver_milestones_without_location.sql'))
    await db.exec(read('supabase/migrations/'+migration))
    await db.exec(`update delivery_requests set travel_started_at=now();update delivery_requests set travel_started_at=coalesce(travel_started_at,now());
      insert into driver_locations values ('${driver}','${job}',(now()-interval '1 minute') at time zone 'UTC');
      update delivery_requests set arrived_at=now();update delivery_requests set purchased_at=now();
      update driver_locations set updated_at=now() at time zone 'UTC';update delivery_requests set status='delivered';`)
    const rows=(await db.query("select details from admin_audit_log order by created_at")).rows
    assert.deepEqual(rows.map(x=>x.details.stage),['travel','arrived','purchased'])
    assert.ok(rows.every(x=>x.details.location==='unavailable'&&!('lat' in x.details)))
    assert.equal((await db.query("select status from delivery_requests")).rows[0].status,'delivered')
    assert.equal((await db.query("select has_function_privilege('authenticated','audit_driver_milestone_location()','execute') as allowed")).rows[0].allowed,false)
  } finally { await db.close() }
})
