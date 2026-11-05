import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as React from 'react'
import * as jsx from 'react/jsx-runtime'
import {renderToStaticMarkup} from 'react-dom/server'
const read=p=>fs.readFileSync(p,'utf8')
function compile(file,imports={},extra={},append=''){
 const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText+append,{exports,require:n=>n==='react/jsx-runtime'?jsx:n==='react'?React:(imports[n]??{}),console,Number,Date,Math,...extra});return exports
}

test('Sandbox payment guard refuses live keys, unconfirmed payments, wrong currency and live provider objects',async()=>{
 for(const [key,paid,live,currency,status,allowed] of [
 ['sk_live_example',true,false,'gbp','succeeded',false],
 ['sk_test_example',false,false,'gbp','succeeded',false],
 ['sk_test_example',true,true,'gbp','succeeded',false],
 ['sk_test_example',true,false,'usd','succeeded',false],
 ['sk_test_example',true,false,'gbp','requires_payment_method',false],
 ['sk_test_example',true,false,'gbp','succeeded',true],
 ]){
  let reads=0,provider=0
  const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:paid?{stripe_payment_intent:'pi_sandbox'}:null})}
  const api=compile('lib/payments/shopping-sandbox.ts',{
   '@/lib/supabase/admin':{createAdminClient:()=>{reads++;return {from:()=>q}}},
   '@/lib/stripe/server':{getStripe:()=>({paymentIntents:{retrieve:async()=>{provider++;return {livemode:live,status,currency}}},balance:{retrieve:async()=>({livemode:live})}})},
  },{process:{env:{STRIPE_SECRET_KEY:key}}})
  if(allowed)assert.equal(await api.requireSandboxPayment('job'),'pi_sandbox')
  else await assert.rejects(api.requireSandboxPayment('job'))
  if(key.startsWith('sk_live')){assert.equal(reads,0);assert.equal(provider,0)}
 }
})

test('Sandbox simulation refuses forged markers and missing or mismatched server-side sessions',async()=>{
 for(const session of [null,{driver_id:'driver',payment_intent:'pi_wrong'},{driver_id:'driver',payment_intent:'pi_ok',simulated_spent:5}]){
  let paymentRead=0
  const db={from:table=>{const q={select:()=>q,eq:()=>q,maybeSingle:async()=>({data:table==='payments'?{stripe_payment_intent:'pi_ok'}:session})};return q}}
  const api=compile('lib/payments/shopping-sandbox.ts',{'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/stripe/server':{getStripe:()=>({paymentIntents:{retrieve:async()=>{paymentRead++;return {livemode:false,status:'succeeded',currency:'gbp'}}},balance:{retrieve:async()=>({livemode:false})}})}},{process:{env:{STRIPE_SECRET_KEY:'sk_test_example'}}})
  await assert.rejects(api.verifiedShoppingSimulation('job','sandbox_someone-else'))
  assert.equal(paymentRead,0)
  if(session?.payment_intent==='pi_ok')assert.equal((await api.verifiedShoppingSimulation('job','sandbox_job')).simulated_spent,5)
  else await assert.rejects(api.verifiedShoppingSimulation('job','sandbox_job'))
 }
})

test('Shopping simulation mutation checks finance permission before enabling a server-side test session',async()=>{
 for(const allowed of [false,true]){
  let rpc=0,checks=0
  const api=compile('app/actions/shopping-operations.ts',{
   '@/lib/admin-access':{getAdminActor:async()=>allowed?{id:'admin'}:null,runAdminMutation:async(a,b,c,fn)=>fn()},
   '@/lib/payments/shopping-sandbox':{requireSandboxPayment:async()=>{checks++;return 'pi_sandbox'}},
   '@/lib/supabase/admin':{createAdminClient:()=>({rpc:async(name,args)=>{rpc++;assert.equal(name,'enable_shopping_simulation');assert.equal(args.p_actor,'admin');assert.equal(args.p_intent,'pi_sandbox');return {error:null}}})},
   'next/cache':{revalidatePath:()=>{}},
  })
  const result=await api.simulateShoppingFunding('job')
  assert.equal(!!result.success,allowed);assert.equal(rpc,allowed?1:0);assert.equal(checks,allowed?1:0)
 }
})

test('Busy-driver assignment explains which active order blocks the assignment',async()=>{
 let rpc=0
 const db={from:()=>{const q={select:()=>q,eq:()=>q,neq:()=>q,in:()=>q,order:()=>q,limit:()=>q,maybeSingle:async()=>({data:rpc?{id:'busy',tracking_number:'GD-BUSY123',status:'accepted'}:{driver_id:null,bfm_stage:null,company_card_reference:null}})};return q},rpc:async()=>{rpc++;return {error:{message:'driver_has_active_job'}}}}
 const api=compile('app/actions/delivery.ts',{'@/lib/admin-access':{getAdminActor:async()=>({id:'admin'}),runAdminMutation:async(a,b,c,fn)=>fn()},'@/lib/supabase/admin':{createAdminClient:()=>db}})
 const result=await api.adminAssignDriver('job','driver','QA assignment')
 assert.match(result.error,/busy.*GD-BUSY123.*accepted/);assert.equal(rpc,1)
})

test('Admin payout list, mobile cards and detail show the saved bank reference',()=>{
 const payout={id:'payout-12345678',driver_id:'driver',payment_reference:'QA-TEST-0001',amount:5,status:'paid',created_at:new Date().toISOString(),driver:{full_name:'QA Driver',email:'qa@example.com',phone:null},driverStats:{totalEarned:5,pendingEarnings:0,completedDeliveries:1}}
 const hooks={...React,useState:v=>[v,()=>{}],useMemo:fn=>fn(),useTransition:()=>[false,()=>{}],useEffect:()=>{}}
 // Override the default React binding for hooks while retaining the real JSX renderer.
 const source=ts.transpileModule(read('components/admin/admin-payouts-panel.tsx'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText
 const exports={};vm.runInNewContext(source+';exports.Detail=PayoutDetailModal',{exports,require:n=>n==='react'?hooks:n==='react/jsx-runtime'?jsx:{},console,Date})
 const html=renderToStaticMarkup(exports.AdminPayoutsPanel({payouts:[payout],pendingDrivers:[],stats:{pendingRequestCount:0,pendingAmount:0,totalPaidOut:5,driversAwaiting:0,platformCommission:0,totalPayoutCount:1}}))
 assert.ok((html.match(/QA-TEST-0001/g)??[]).length>=2)
 assert.match(renderToStaticMarkup(exports.Detail({payout,onClose:()=>{}})),/Bank reference:.*QA-TEST-0001/)
 assert.match(read('app/actions/payouts.ts'),/select\("id, amount, status, created_at, payment_reference"\)/)
})

test('Grace settings and checkout wording share the validated policy; footer links all have 44px targets',()=>{
 const api=compile('lib/cancellation-policy.ts')
 assert.equal(api.DEFAULT_CANCELLATION.graceMinutes,2)
 assert.match(api.cancellationSummary(api.DEFAULT_CANCELLATION),/2 minutes.*no arrival grace/)
 assert.equal(api.validCancellationSettings({...api.DEFAULT_CANCELLATION,graceMinutes:1.5}),false)
 assert.equal(api.validCancellationSettings({...api.DEFAULT_CANCELLATION,graceMinutes:5}),true)
 const Link=({children,href,...props})=>jsx.jsx('a',{href,...props,children})
 const footer=compile('components/layout/Footer.tsx',{'next/link':{default:Link},'@/components/public/support-contact-links':{SupportContactLinks:()=>null}}).default
 const html=renderToStaticMarkup(footer())
 const links=[...html.matchAll(/<a\b[^>]+>/g)]
 assert.equal(links.length,6);for(const link of links)assert.match(link[0],/min-h-11/)
 assert.doesNotMatch(read('components/public/public-navbar.tsx'),/backdrop-blur/)
 assert.match(read('components/customer/DeliverySteps.module.css'),/\.body\[data-step="3"\][^{]*\{padding-bottom:calc\(72px/)
})
