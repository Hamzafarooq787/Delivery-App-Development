import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import {renderToStaticMarkup} from 'react-dom/server'
import * as jsx from 'react/jsx-runtime'
const read=p=>fs.readFileSync(p,'utf8')
function load(file,imports={},extra={}){const exports={};vm.runInNewContext(ts.transpileModule(read(file),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022,jsx:ts.JsxEmit.ReactJSX}}).outputText,{exports,URL,URLSearchParams,AbortSignal,AbortController,console,...extra,require:n=>n==='react/jsx-runtime'?jsx:(n in imports?imports[n]:(()=>{throw Error(n)})())});return exports}
const tracking=load('lib/public-tracking.ts')
test('Shipment lists and details use the exact primary order-to-payment foreign key',()=>{
 const {SHIPMENT_COLUMNS}=load('lib/shipment-query.ts')
 assert.match(SHIPMENT_COLUMNS,/payments!payments_delivery_id_fkey\(amount,payment_method,refund_jobs\)/)
 const source=read('components/customer/CustomerShipments.tsx')
 assert.equal(source.match(/\bSHIPMENT_COLUMNS\b/g).length,3)
 assert.match(source,/\.eq\('customer_id',\s*user\.id\)/)
 assert.match(source,/\.eq\('customer_id',userId\)/)
})
test('Review uses selected size, rejects stale quote inputs, and sends the same size to checkout',()=>{
 const source=read('components/customer/NewDeliveryModal.tsx')
 assert.match(source,/quoteKey = JSON\.stringify\(\[pickupCoords, deliveryCoords, packageSize, promoCode\.trim\(\)\]\)/)
 assert.match(source,/quoted\?\.key === quoteKey \? quoted\.value : null/)
 assert.match(source,/PACKAGE_SIZE_INFO\[packageSize\]\.label/)
 assert.match(source,/package_size: packageSize/)
 assert.match(source,/getDeliveryQuote\(\{[\s\S]+?packageSize,/)
})
test('£146.13 fits the live base/mileage schedule at about 120.033 miles; size charges apply only as configured',()=>{
 const {calculateDeliveryFare,DEFAULT_BOOKING_PRICING}=load('lib/booking-pricing.ts')
 const config={...DEFAULT_BOOKING_PRICING,largeFee:8,vanFee:20}
 assert.equal(calculateDeliveryFare(120.033333,config,'medium'),146.13)
 assert.equal(calculateDeliveryFare(120.033333,config,'large'),154.13)
 assert.equal(calculateDeliveryFare(2,config,'medium'),4.49)
})
test('Shopping loads one configured limit and the editor keeps decimal text local until save',()=>{
 const form=read('components/customer/ShoppingBookingForm.tsx'), editor=read('components/customer/ShoppingItemEditor.tsx')
 assert.match(form,/maximum = settings\?\.max_purchase_amount \?\? null/)
 assert.match(form,/maximum === null \? "Loading shopping limit/)
 assert.match(form,/maximum === null \? "—" : money\(maximum\)/)
 assert.match(form,/<ShoppingItemEditor key=\{editor\.id\}/)
 assert.match(editor,/value=\{price\} onChange=\{e => setPrice\(e.target.value\)\}/)
 assert.match(editor,/estimated_price: price\.trim\(\) === "" \? null/); assert.match(editor,/type="text" maxLength=\{8\} inputMode="decimal"/)
 assert.doesNotMatch(editor,/<label>Quantity/)
})
test('Debounce only starts the latest address request and selection cancels an in-flight search',async()=>{
 const timers=new Map();let n=0
 const {createAddressRequest,ADDRESS_DEBOUNCE_MS}=load('lib/address-request.ts',{},{
  setTimeout:(fn,ms)=>{assert.equal(ms,220);timers.set(++n,fn);return n},
  clearTimeout:id=>timers.delete(id),
 })
 assert.equal(ADDRESS_DEBOUNCE_MS,220)
 const queue=createAddressRequest(),seen=[]
 queue.search(async()=>seen.push('old'))
 queue.search(async signal=>seen.push(signal))
 assert.equal(timers.size,1)
 await [...timers.values()][0]()
 assert.equal(seen.length,1)
 const selection=queue.start()
 assert.equal(seen[0].aborted,true)
 assert.equal(selection.aborted,false)
 queue.cancel()
 assert.equal(selection.aborted,true)
})
test('Tracking lookup only reads status, normalises codes and renders found, missing and outage states',async()=>{
 let calls=[]
 const page=load('app/(public)/track/page.tsx',{
  '@/lib/public-tracking':tracking,
  '@/lib/supabase/admin':{createAdminClient:()=>({from:table=>({select:fields=>({eq:(key,value)=>({maybeSingle:async()=>{
   calls.push({table,fields,key,value})
   if(value==='TRK-OUTAGE')return{error:true}
   return {data:value==='TRK-KNOWN'?{status:'delivered',address:'private-address'}:null}
  }})})})})},
 }).default
 const render=async number=>renderToStaticMarkup(await page({searchParams:Promise.resolve({number})}))
 assert.match(await render(' trk-known '),/Delivered/)
 assert.doesNotMatch(await render('trk-known'),/private-address/)
 assert.match(await render('TRK-TEST-000000'),/Shipment not found/)
 assert.match(await render('TRK-OUTAGE'),/temporarily unavailable/)
 const before=calls.length
 assert.match(await render('x,or(*)'),/Shipment not found/)
 assert.equal(calls.length,before)
 assert.ok(calls.every(c=>c.fields==='status'&&c.key==='tracking_number'))
})
test('Public tracking entry points are real forms and links, and old fleet links redirect',async()=>{
 const header=read('components/layout/Header.tsx')
 assert.equal((header.match(/<form action="\/track"/g)??[]).length,2)
 assert.equal((header.match(/name="number"/g)??[]).length,2)
 assert.match(header,/href: '\/our-fleet'/)
 assert.match(read('components/home/HomeSlides.tsx'),/href="\/track"/)
 const config=(await import('../next.config.mjs')).default
 assert.deepEqual(await config.redirects(),[{source:'/fleet',destination:'/our-fleet',permanent:true}])
})
test('Order test flag is permission-gated and only appends audit metadata for terminal orders',async()=>{
 const events=[];let scope=false,status='delivered',reads=0
 const {setOrderTestRecord}=load('app/actions/order-test-record.ts',{
  'next/cache':{revalidatePath:()=>{}},
  '@/lib/admin-access':{getAdminActor:async s=>{assert.equal(s,'operations');return scope?{id:'admin'}:null},auditAdmin:async(...args)=>events.push(args)},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:t=>{reads++;assert.equal(t,'delivery_requests');return{select:()=>({eq:()=>({maybeSingle:async()=>({data:{id:'x',status}})})})}}})},
 })
 const id='6cc747ab-6f9a-490a-92a6-d09702c85d99'
 assert.ok((await setOrderTestRecord(id,true)).error)
 assert.equal(reads,0)
 scope=true;status='accepted'
 assert.ok((await setOrderTestRecord(id,true)).error)
 status='delivered'
 assert.equal((await setOrderTestRecord(id,true)).success,true)
 assert.equal(events.length,1)
 assert.equal(events[0][1],'order_test_record')
 assert.equal(events[0][3].flagged,true)
})
test('UK signup accepts national and international forms and rejects other country codes',()=>{
 const {normaliseUKPhone}=load('lib/uk-phone.ts')
 for(const value of ['+44 7700 900123','07700 900123','0044 7700 900123'])assert.equal(normaliseUKPhone(value),'+447700900123')
 assert.equal(normaliseUKPhone('020 7946 0123'),'+442079460123')
 for(const value of ['+92 300 1234567','+44','07700x900123','447700900123',null])assert.equal(normaliseUKPhone(value),null)
})
test('Contact hides empty settings and renders configured email and telephone links only',async()=>{
 let platform_settings={email:'',phone:''}
 const page=load('app/(public)/contact/page.tsx',{
  './contact-form':{ContactForm:()=>null},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select:()=>({eq:(key,value)=>{assert.equal(value,true);return{maybeSingle:async()=>({data:{platform_settings}})}}})})})},
 }).default
 assert.doesNotMatch(renderToStaticMarkup(await page()),/mailto:|tel:|ops@godrop/)
 platform_settings={email:'support@example.test',phone:'+44 20 7946 0123'}
 const html=renderToStaticMarkup(await page())
 assert.match(html,/mailto:support@example.test/)
 assert.match(html,/tel:\+442079460123/)
})
test('Contact and How It Works use plain wording and the correct brand spelling',()=>{
 for(const path of ['app/(public)/contact/page.tsx','app/(public)/contact/contact-form.tsx','app/(public)/how-it-works/page.tsx']){
  assert.doesNotMatch(read(path),/mission control|transmit signal|the void|swarm intelligence|initialize network|Go Drop/i)
 }
 assert.match(read('components/layout/Footer.tsx'),/new Date\(\)\.getFullYear\(\).*GoDrop/)
 assert.match(read('app/login/layout.tsx'),/Sign in \| GoDrop/)
 assert.ok(fs.statSync('public/favicon.ico').size>0)
 assert.equal(fs.readFileSync('public/apple-touch-icon.png').readUInt32BE(16),180)
})
test('OAuth callback never replays a single-use code and redirects upstream 522 errors to a safe retry page',async()=>{
 let exchanges=0
 const {GET}=load('app/auth/callback/route.ts',{
  'next/server':{NextResponse:{redirect:url=>url.toString()}},
  '@/lib/supabase/server':{createClient:async customFetch=>{assert.equal(typeof customFetch,'function');return{auth:{exchangeCodeForSession:async()=>{exchanges++;return{error:{status:522,message:'private provider error'}}}}}}},
  '@/lib/auth-profile':{},'@/lib/supabase/admin':{},
 })
 assert.equal(await GET({url:'https://godrop.uk/auth/callback?code=one-use'}),'https://godrop.uk/login?error=oauth_unavailable')
 assert.equal(exchanges,1)
 assert.equal(await GET({url:'https://godrop.uk/auth/callback'}),'https://godrop.uk/login?error=missing_oauth_code')
 assert.equal(exchanges,1)
})
test('OAuth error pages safely handle unusual codes and never echo them into the page',()=>{
 const {oauthErrorMessage}=load('lib/oauth-error-message.ts')
 assert.match(oauthErrorMessage('oauth_unavailable'),/temporarily unavailable/)
 const fallback=oauthErrorMessage('oauth_failed')
 for(const code of ['__proto__','constructor','%','<provider error>'])assert.equal(oauthErrorMessage(code),fallback)
 assert.equal(oauthErrorMessage(null),null)
})
