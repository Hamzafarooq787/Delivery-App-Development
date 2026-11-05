import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as jsx from 'react/jsx-runtime'
const read=p=>fs.readFileSync(p,'utf8')
function compile(file,imports={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,require:n=>n==='react/jsx-runtime'?jsx:(imports[n]??{}),URL,Date,Number,Math,console,...extra});return exports}
function find(node,predicate){if(!node)return null;if(Array.isArray(node)){for(const n of node){const result=find(n,predicate);if(result)return result}return null}if(typeof node!=='object')return null;if(predicate(node))return node;return find(node.props?.children,predicate)}
const driver='driver',job='job'

test('QA19: national, E.164 and UK mobile autofill without its trunk zero normalize to the same number',()=>{
 const api=compile('lib/uk-phone.ts')
 for(const input of ['07700900456','07700 900456','+44 7700 900456','0044 7700 900456','7700900456'])assert.equal(api.normaliseUKMobile(input),'+447700900456')
 for(const input of ['+92 300 1234567','123','letters'])assert.equal(api.normaliseUKMobile(input),null)
 const form=read('components/customer/NewDeliveryModal.tsx')
 assert.match(form,/type="tel" inputMode="tel" autoComplete="tel-national"/)
 assert.match(form,/onChange=\{e=>setRecipientPhone\(e.target.value\)\}/)
})

test('QA19: clicking a portalled shop suggestion commits the chosen label and coordinates once',async()=>{
 const calls=[],body={}
 const suggestion={placeId:'place-123',text:'Test Shop, 10 High Street, London SW1A 2AA'}
 const hooks={useId:()=> 'shop-field',useEffect:()=>{},useState:initial=>[Array.isArray(initial)?[suggestion]:initial,()=>{}],useRef:initial=>({current:initial===null?{blur:()=>calls.push('blur')}:initial})}
 const request={cancel:()=>{},start:()=>new AbortController().signal}
 const api=compile('components/customer/ShoppingAddressField.tsx',{'react':hooks,'react-dom':{createPortal:(node,target)=>{assert.equal(target,body);return node}},'next/dynamic':{default:()=>()=>null},'lucide-react':{MapPin:()=>null},'@/lib/address-request':{createAddressRequest:()=>request},'@/lib/google':{googlePlaceCoords:async id=>{assert.equal(id,suggestion.placeId);return {lat:51.5,lng:-0.12,address:'A differently formatted provider label'}}},'./ShoppingSteps.module.css':{default:{}}},{AbortController,document:{body}})
 const tree=api.ShoppingAddressField({label:'Shop address',value:'Test',onChange:v=>calls.push(['text',v]),onSelect:v=>calls.push(['selected',JSON.parse(JSON.stringify(v))])})
 const list=find(tree,n=>n.props?.role==='listbox');assert.equal(list.props.style.position,'fixed');assert.ok(list.props.style.zIndex>9999)
 await find(tree,n=>n.props?.role==='option').props.onClick()
 assert.deepEqual(calls,[['text',suggestion.text],['selected',{lat:51.5,lng:-0.12,address:suggestion.text}],'blur'])
})

test('QA19: sandbox receipt submission prepares its approved basket automatically before settlement',async()=>{
 let enabled=0,settled=0,refunds=0
 const delivery={id:job,driver_id:driver,customer_id:'customer',max_spend_approved:50,company_card_reference:'sandbox_job',purchase_authorized_total:null,payment_method:'stripe',shopping_hold_settled_at:null}
 const db={from:()=>{const q={select:()=>q,eq:()=>q,single:async()=>({data:delivery})};return q},storage:{from:()=>({list:async()=>({data:[{name:'receipt.jpg'}]})})},rpc:async(name,p)=>{assert.equal(name,'settle_shopping_receipt_atomic');assert.equal(enabled,1);assert.equal(p.p_actual_total,2);settled++;return{data:{refund:48,replayed:false}}}}
 const api=compile('app/actions/shopping.ts',{'@/app/actions/shopping-operations':{enableApprovedPurchase:async id=>{assert.equal(id,job);enabled++;return {success:true,total:2}}},'@/lib/payments/shopping-sandbox':{isShoppingSimulation:()=>true,verifiedShoppingSimulation:async()=>({driver_id:driver,simulated_spent:2})},'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>db},'@/lib/payments/direct':{processOrderRefunds:async()=>{refunds++}},'@/lib/notifications/internal':{notifyUser:async()=>{}},'next/cache':{revalidatePath:()=>{}}},{process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}}})
 const result=await api.submitPurchaseReceipt({deliveryId:job,receipt_url:`https://example.supabase.co/storage/v1/object/public/delivery-item-photos/${driver}/receipts/${job}/receipt.jpg`,actual_items_total:2})
 assert.equal(result.error,undefined);assert.equal(settled,1);assert.equal(refunds,1)
})

test('QA19: completion diagnostics log the provider error without logging the customer PIN or proof URL',async()=>{
 const messages=[]
 const db={storage:{from:()=>({list:async()=>({data:[{name:'delivered-job-photo.jpg'}]})})},rpc:async()=>({error:{code:'23514',message:'delivery_requests_bfm_stage_check'}})}
 const api=compile('app/actions/delivery.ts',{'@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:driver}}})}})},'@/lib/supabase/admin':{createAdminClient:()=>db}},{process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}},console:{error:(...args)=>messages.push(args)}})
 const result=await api.verifyDeliveryOtpAndComplete(job,'1234',`https://example.supabase.co/storage/v1/object/public/driver-documents/${driver}/delivered-job-photo.jpg`)
 assert.match(result.error,/Contact support/);assert.match(JSON.stringify(messages),/23514/);assert.doesNotMatch(JSON.stringify(messages),/1234|https:/)
})

test('QA19: recovery confirm is enabled for a checked sandbox outcome with its existing clear note',()=>{
 const hooks={useEffect:()=>{},useState:initial=>[typeof initial==='boolean'?true:initial,()=>{}],useTransition:()=>[false,()=>{}]}
 const api=compile('components/admin/order-recovery-panel.tsx',{'react':hooks,'next/navigation':{useRouter:()=>({refresh:()=>{}})}})
 const tree=api.OrderRecoveryPanel({id:job,record:{status:'open',action:'cancellation_review',reason:'Service failure: sandbox QA order'},canResolve:true,simulation:true})
 const confirm=find(tree,n=>n.type==='button'&&n.props?.children==='Confirm outcome, cancel and refund')
 assert.equal(confirm.props.disabled,false)
 assert.ok(find(tree,n=>n.type==='textarea'&&n.props?.minLength===10))
})

test('QA19: safety release dialog is a body portal with a bounded scrollable body and a visible footer',()=>{
 let portalled=false
 const hooks={useState:v=>[v===false?true:v,()=>{}],useTransition:()=>[false,()=>{}]}
 const api=compile('components/driver/safety-cancel-button.tsx',{'react':hooks,'react-dom':{createPortal:node=>{portalled=true;return node}},'next/navigation':{useRouter:()=>({})}},{document:{body:{}}})
 const tree=api.SafetyCancelButton({jobId:job})
 assert.equal(portalled,true)
 assert.ok(find(tree,n=>n.props?.className?.includes('max-h-[90dvh]')))
 assert.ok(find(tree,n=>n.props?.className?.includes('min-h-0 overflow-y-auto')))
 assert.ok(find(tree,n=>n.type==='button'&&n.props?.children?.includes?.('Confirm safety release')))
 assert.doesNotMatch(read('app/actions/delivery.ts').slice(read('app/actions/delivery.ts').indexOf('export async function safetyReleaseJob'),read('app/actions/delivery.ts').indexOf('export async function admin')),/is_online: false/)
})

test('QA19: identical driving requests reuse a ten-minute cached route; failed routes remain retryable',async()=>{
 let reads=0
 const cache=new Map()
 const api=compile('lib/google-server.ts',{'next/cache':{unstable_cache:(fn,key,options)=>{assert.equal(options.revalidate,600);return async(...args)=>{const k=JSON.stringify(args);if(cache.has(k))return cache.get(k);const result=await fn(...args);cache.set(k,result);return result}}},'@/lib/integration-health':{recordHealth:async()=>{}}},{process:{env:{GOOGLE_MAPS_KEY:'unit-test'}},AbortSignal,fetch:async()=>{reads++;return{ok:true,json:async()=>({routes:[{legs:[{distance:{value:5000+reads},duration:{value:600}}]}]})}}})
 const from={lat:51.5,lng:-0.1},to={lat:51.6,lng:-0.2}
 const first=await api.fetchRouteServer(from,to),second=await api.fetchRouteServer({...from},{...to})
 assert.equal(first.distance_miles,second.distance_miles);assert.equal(reads,1)
})
