import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {PGlite} from '@electric-sql/pglite'

function load(file,imports={},extra={}) {
  const exports={}
  vm.runInNewContext(ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>imports[name],...extra})
  return exports
}

test('Parcel contact validates a UK number and a future collection time; postcodes compare without spacing',()=>{
  const {parcelContact,addressPostcode}=load('lib/parcel-contact.ts',{'./uk-phone':load('lib/uk-phone.ts')})
  const now=Date.parse('2026-11-04T10:00:00Z')
  assert.equal(parcelContact('Jane Smith','07700 900123','asap',now).recipient_phone,'+447700900123')
  assert.equal(parcelContact('Jane Smith','020 7946 0123','2026-11-05T10:00:00Z',now).collection_at,'2026-11-05T10:00:00.000Z')
  assert.ok(parcelContact('Jane Smith','+923001234567','asap',now).error)
  assert.ok(parcelContact('Jane Smith','07700 900123','2026-11-03T10:00:00Z',now).error)
  assert.equal(addressPostcode('221B Baker Street, London NW1 6XE'),'NW16XE')
  assert.notEqual(addressPostcode('221B Baker St, London W1U 6QQ'),'NW16XE')
})

test('Review draft survives reload in the same tab and is isolated by account',()=>{
  const rows=new Map()
  const sessionStorage={getItem:k=>rows.get(k),setItem:(k,v)=>rows.set(k,v),removeItem:k=>rows.delete(k)}
  const first=load('lib/delivery-draft.ts',{}, {sessionStorage})
  first.saveDeliveryDraft('owner',{step:3,recipientName:'Jane Smith',checkoutKey:'same-key'})
  const afterReload=load('lib/delivery-draft.ts',{}, {sessionStorage})
  assert.equal(afterReload.loadDeliveryDraft('other'),null)
  assert.equal(afterReload.loadDeliveryDraft('owner').checkoutKey,'same-key')
  assert.equal(afterReload.loadDeliveryDraft('owner').step,3)
  afterReload.clearDeliveryDraft('owner')
  assert.equal(first.loadDeliveryDraft('owner'),null)
})

test('Only the paid booking copies recipient and collection information to its own parcel',async()=>{
  const db=new PGlite()
  try{
    await db.exec(`create role anon;create role authenticated;
      create table delivery_requests(id uuid primary key,customer_id uuid,service_type text);
      create table payments(id int primary key,delivery_id uuid,customer_id uuid,status text,purpose text,payment_method text,booking_draft jsonb);`)
    await db.exec(fs.readFileSync('supabase/migrations/20261104180000_parcel_contact_details.sql','utf8'))
    const parcel='00000000-0000-4000-8000-000000000001', owner='00000000-0000-4000-8000-000000000002'
    await db.query("insert into delivery_requests values($1,$2,'delivery')",[parcel,owner])
    const draft=JSON.stringify({service_type:'delivery',recipient_name:'Jane',recipient_phone:'+447700900123',collection_at:'2026-11-05T11:00:00Z'})
    await db.query("insert into payments values(1,$1,$2,'pending','booking','stripe',$3)",[parcel,owner,draft])
    assert.equal((await db.query('select recipient_name from delivery_requests')).rows[0].recipient_name,null)
    await db.exec("update payments set status='paid' where id=1")
    assert.equal((await db.query('select recipient_phone from delivery_requests')).rows[0].recipient_phone,'+447700900123')
  }finally{await db.close()}
})

test('Proxy forwards refreshed cookie chunks to both the request and browser',async()=>{
  function jar(){const values=new Map();return {getAll:()=>Array.from(values.values()),set:(name,value)=>{const c=typeof name==='string'?{name,value}:name;values.set(c.name,c)}}}
  function response(){return {cookies:jar(),headers:new Headers()}}
  const {proxy}=load('proxy.ts',{
    '@/lib/short-request':{boundedFetch:()=>fetch},
    'next/server':{NextResponse:{next:()=>response(),redirect:()=>response()}},
    '@supabase/ssr':{createServerClient:(_url,_key,{cookies})=>({auth:{getClaims:async()=>{
      cookies.setAll([{name:'session.0',value:'new-0'},{name:'session.1',value:'new-1'}])
      return {data:{claims:{sub:'customer'}},error:null}
    }}})},
  },{process:{env:{}},URL})
  const cookies=jar()
  const result=await proxy({nextUrl:new URL('https://godrop.uk/login'),url:'https://godrop.uk/login',cookies})
  assert.deepEqual(cookies.getAll().map(c=>c.value),['new-0','new-1'])
  assert.deepEqual(result.cookies.getAll().map(c=>c.value),['new-0','new-1'])
  assert.equal(result.headers.get('Cache-Control'),'private, no-store')
})

test('A signed Stripe expiry only updates the matching unpaid checkout attempt',async()=>{
  const calls=[]
  const q={update(v){calls.push(['update',v.status]);return q},eq(k,v){calls.push([k,v]);return q},then(done){done({error:null})}}
  const session={id:'cs_test_fixture',metadata:{payment_id:'00000000-0000-4000-8000-000000000001',type:'order_booking'},status:'expired',payment_status:'unpaid',currency:'gbp',amount_total:1300}
  const {POST}=load('app/api/stripe/webhook/route.ts',{
    'next/server':{NextResponse:Response},
    '@/lib/integration-health':{recordHealth:async()=>{}},
    '@/lib/payments/waiting':{},
    '@/lib/payments/direct':{},
    '@/lib/notifications/internal':{},
    '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q})},
    '@/lib/stripe/server':{isStripeConfigured:()=>true,getStripe:()=>({webhooks:{constructEvent:()=>({type:'checkout.session.expired',data:{object:session}})}})},
  },{process:{env:{STRIPE_WEBHOOK_SECRET:'fixture-secret'}},console})
  const request=new Request('https://godrop.uk/api/stripe/webhook',{method:'POST',body:'{}',headers:{'stripe-signature':'fixture'}})
  assert.equal((await POST(request)).status,200)
  assert.ok(calls.some(([k,v])=>k==='stripe_session_id'&&v===session.id))
  assert.ok(calls.some(([k,v])=>k==='status'&&v==='pending'))
  assert.ok(calls.some(([k,v])=>k==='amount'&&v===13))
})
