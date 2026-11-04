import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
const read=path=>fs.readFileSync(path,'utf8')
function load(path,imports={}) {
 const exports={}
 vm.runInNewContext(ts.transpileModule(read(path),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports,require:name=>imports[name],Response,Request,File,FormData,URL,Uint8Array,AbortSignal})
 return exports
}
test('Pickup endpoint validates JPEG and assigned accepted parcel before writing, and retries the same key',async()=>{
 const job='00000000-0000-4000-8000-000000000001', key='00000000-0000-4000-8000-000000000002'
 const calls=[];let assigned=false
 const query={select:()=>query,eq:(k,v)=>{calls.push([k,v]);return query},maybeSingle:async()=>({data:assigned?{id:job}:null})}
 const storage={upload:async path=>{calls.push(['upload',path]);return {error:{statusCode:'409',message:'Already exists'}}},getPublicUrl:path=>({data:{publicUrl:path}})}
 const {POST}=load('app/api/driver/pickup-photo/route.ts',{
  '@/lib/short-request':{boundedFetch:()=>{},shortRequest:work=>work},
  '@/lib/supabase/server':{createClient:async()=>({auth:{getClaims:async()=>({data:{claims:{sub:'driver'}}})}})},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>query,storage:{from:()=>storage}})},
 })
 const make=(bytes,origin='https://godrop.uk')=>{const form=new FormData();form.set('id',job);form.set('key',key);form.set('photo',new File([new Uint8Array(bytes)],'parcel.jpg',{type:'image/jpeg'}));return new Request('https://godrop.uk/api/driver/pickup-photo',{method:'POST',headers:{origin},body:form})}
 assert.equal((await POST(make([255,216,255,0],'https://example.invalid'))).status,403)
 assert.equal((await POST(make([1,2,3,4]))).status,400)
 assert.equal((await POST(make([255,216,255,0]))).status,403)
 assert.equal(calls.some(([k])=>k==='upload'),false)
 assigned=true
 const expected='driver/parcel-'+job+'-'+key+'.jpg'
 for(let i=0;i<2;i++)assert.equal((await (await POST(make([255,216,255,0]))).json()).url,expected)
 assert.ok(calls.some(([k,v])=>k==='status'&&v==='accepted'))
})
test('Pickup UI retains the uploaded proof for a separate save retry',()=>{
 const ui=read('components/driver/parcel-auth-modal.tsx')
 assert.match(ui,/if \(!uploadedPhoto.current\)/)
 assert.match(ui,/uploadedPhoto.current=result.url[\s\S]*markParcelCollected\(deliveryId,uploadedPhoto.current!\)/)
 assert.match(ui,/Choose photo file/)
})
test('Tracking lookup accepts both current and legacy booking prefixes',()=>{
 const {normaliseTrackingNumber}=load('lib/public-tracking.ts')
 assert.equal(normaliseTrackingNumber(' gd-eccaa5c6 '),'GD-ECCAA5C6')
 assert.equal(normaliseTrackingNumber('trk-1792222330059-akmo'),'TRK-1792222330059-AKMO')
})
test('Every Stripe Checkout creation explicitly disables adaptive pricing',()=>{
 for(const path of ['app/actions/order-checkout.ts','app/actions/payments.ts','lib/payments/waiting-checkout.ts']){
  const source=read(path)
  assert.match(source,/checkout\.sessions\.create\([\s\S]*?adaptive_pricing:\s*\{\s*enabled:\s*false/)
 }
})
