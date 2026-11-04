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
 const source=read('app/api/customer/shipments/route.ts')
 assert.match(source,/select\(SHIPMENT_COLUMNS/)
 assert.match(source,/\.eq\("customer_id",user\.id\)/)
 assert.match(source,/base\.eq\("id",id\)/)
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
  '@/lib/short-request':load('lib/short-request.ts',{}, {setTimeout,clearTimeout}),
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

const fakeLink = {default: ({children,...props}) => jsx.jsx('a',{...props,children})}
const fakeIcons = new Proxy({}, {get:()=>props=>jsx.jsx('svg',props)})

test('Public pricing uses live booking rates, fee and funds and recalculates an example when settings change',async()=>{
 const booking=load('lib/booking-pricing.ts')
 let rates={...booking.DEFAULT_BOOKING_PRICING}
 let shopping={enabled:true,max_purchase_amount:50}, busy={master_enabled:false}
 const {default:Page,dynamic}=load('app/(public)/pricing/page.tsx',{
  'next/link':fakeLink,'@/lib/booking-pricing':booking,
  '@/app/actions/booking-settings':{getBookingPricing:async()=>{if(!rates)throw Error();return rates}},
  '@/app/actions/shopping':{getBfmSettings:async()=>shopping},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select:()=>({eq:()=>({single:async()=>({data:busy})})})})})},
 })
 assert.equal(dynamic,'force-dynamic')
 let html=renderToStaticMarkup(await Page())
 for(const value of ['£4.49','£1.20','£3.99','£50.00','£8.09','currently off'])assert.ok(html.includes(value),value)
 rates={...rates,baseFare:6,includedMiles:1,perMile:2,shoppingFee:5,largeFee:3,vanFee:4,weatherFee:1,waitingPerMinute:.65}
 shopping={enabled:true,max_purchase_amount:60};busy={master_enabled:true,traffic_enabled:true,demand_enabled:true}
 html=renderToStaticMarkup(await Page())
 for(const value of ['First 1 mile','£13.00','£60.00','£0.65','heavy traffic','£5.00'])assert.ok(html.includes(value),value)
 rates=null;shopping={enabled:false}
 html=renderToStaticMarkup(await Page())
 assert.match(html,/Current rates are unavailable/)
 assert.match(html,/Buy for Me is currently unavailable/)
 assert.doesNotMatch(html,/£4.49|£60.00/)
})
test('Fleet renders the same vehicles and parcel capacity combinations as booking and driver settings',()=>{
 const vehicles=load('lib/vehicles.ts')
 const {default:Page}=load('app/(public)/our-fleet/page.tsx',{'next/link':fakeLink,'lucide-react':fakeIcons,'@/lib/vehicles':vehicles})
 const html=renderToStaticMarkup(Page())
 for(const type of vehicles.VEHICLE_TYPES){
  const card=html.split('<article').find(fragment=>fragment.includes('>'+vehicles.VEHICLE_INFO[type].label+'</h2>'))
  assert.ok(card)
  assert.ok(card.includes(vehicles.VEHICLE_CAPABILITIES[type].map(size=>vehicles.PACKAGE_SIZE_INFO[size].label).join(', ')))
 }
 assert.match(html,/verified local driver/)
 assert.doesNotMatch(html,/drone|autonom/i)
})
test('Public copy audit excludes obsolete claims and the guide renders SVG icons',()=>{
 const banned=/\b(?:kinetic|quantum|transmit|mission|telemetry|autonomous|autonomy|lidar|neural|velocity|mobilize|globally|swarm|handshake|supremacy|cryo|aero-drone)\b|\b(?:the void|send a signal|every node)\b/i
 for(const base of ['app/(public)','components/home','components/layout','components/public'])
  for(const file of fs.readdirSync(base,{recursive:true}).filter(x=>/\.tsx?$/.test(x)))assert.doesNotMatch(read(base+'/'+file),banned,base+'/'+file)
 const {default:Page}=load('app/(public)/how-it-works/page.tsx',{'next/link':fakeLink,'lucide-react':fakeIcons})
 const html=renderToStaticMarkup(Page())
 assert.ok((html.match(/<svg/g)??[]).length>=11)
 assert.doesNotMatch(html,/[📡📊🔀🕸]/u)
 assert.match(read('app/(public)/contact/contact-form.tsx'),/Send us a message[\s\S]*you@example.com/)
})
test('Footer has one normal-case copyright and home and standalone public pages use it',()=>{
 const {default:Footer}=load('components/layout/Footer.tsx',{'next/link':fakeLink})
 const html=renderToStaticMarkup(Footer())
 assert.match(html,/GoDrop\. All rights reserved\./)
 assert.match(html,/Local collection and delivery across the UK/)
 assert.doesNotMatch(html,/GODROP|\buppercase\b/)
 for(const page of ['app/signup/page.tsx','app/login/page.tsx'])assert.doesNotMatch(read(page),/All rights reserved/)
 assert.match(read('components/home/HomeSlides.tsx'),/<Footer \/>/)
 assert.match(read('components/layout/PublicShell.tsx'),/<Footer \/>/)
 assert.match(read('components/layout/StandaloneFooter.tsx'),/"\/login", "\/signup"/)
})
test('Signup mobile validation shares the server rule and attaches an accessible blur error',()=>{
 const {normaliseUKMobile,UK_MOBILE_ERROR}=load('lib/uk-phone.ts')
 for(const value of ['+44 7700 900123','07700 900123','0044 7700 900123'])assert.equal(normaliseUKMobile(value),'+447700900123')
 for(const value of ['+92 300 1234567','020 7946 0123','07000 900123',null])assert.equal(normaliseUKMobile(value),null)
 assert.equal(UK_MOBILE_ERROR,'Please enter a UK mobile number')
 const source=read('app/signup/page.tsx')
 assert.match(source,/onBlur=\{\(\) => setPhoneTouched\(true\)\}/)
 assert.match(source,/aria-describedby=\{phoneError \? "phone-error"/)
 assert.match(source,/id="phone-error" role="alert"/)
 assert.match(read('app/actions/auth.ts'),/normaliseUKMobile\(formData.get\("phone"\)\)/)
})
test('Admin declares its own title and old cached admin documents are retired',()=>{
 assert.match(read('app/dashboard/admin/layout.tsx'),/title: "GoDrop Admin"/)
 assert.doesNotMatch(read('app/layout.tsx'),/Go Drop|Premium Logistics/)
 const worker=read('app/firebase-messaging-sw.js/route.ts')
 assert.match(worker,/godrop-cache-v3/)
 const adminBranch=worker.split('// Admin pages depend')[1].split('// Navigations:')[0]
 assert.match(adminBranch,/fetch\(request\)/)
 assert.doesNotMatch(adminBranch,/caches.match\(request\)|cache.put/)
})

test('Shipment API bounds upstream auth and reads only the verified customer, regardless of URL input',async()=>{
 const columns=load('lib/shipment-query.ts'), filters=[]
 const q={select:()=>q,eq:(k,v)=>{filters.push([k,v]);return q},abortSignal:s=>{assert.ok(s);return q},in:()=>q,order:()=>q,range:async()=>({data:[{id:'owned'}],count:1,error:null})}
 let mode='ok'
 const {GET}=load('app/api/customer/shipments/route.ts',{
  '@/lib/shipment-query':columns,
  '@/lib/supabase/server':{createClient:async custom=>{
   assert.equal(typeof custom,'function')
   return {auth:{getUser:async()=>mode==='timeout'?{data:{user:null},error:{name:'AuthRetryableFetchError'}}:mode==='signed-out'?{data:{user:null}}:{data:{user:{id:'owner'}}}},from:()=>q}
  }},
 },{Response})
 const req=new Request('https://godrop.uk/api/customer/shipments?history=1&customer_id=other')
 const good=await GET(req)
 assert.equal(good.status,200)
 assert.equal(good.headers.get('cache-control'),'private, no-store')
 assert.deepEqual(filters,[['customer_id','owner']])
 assert.equal((await good.json()).rows[0].id,'owned')
 mode='timeout';assert.equal((await GET(req)).status,504)
 mode='signed-out';assert.equal((await GET(req)).status,401)
})
test('An SDK promise that never settles releases the UI deadline, and shipment failure does not display an empty state',async()=>{
 const {shortRequest}=load('lib/short-request.ts',{}, {setTimeout,clearTimeout})
 await assert.rejects(shortRequest(new Promise(()=>{}),8),/Request timed out/)
 const ui=read('components/customer/CustomerShipments.tsx')
 assert.match(ui,/error && !rows.length \? null/)
 assert.match(ui,/AbortSignal.timeout\(2850\)/)
 assert.match(ui,/setLoading\(false\)[\s\S]*getDriverNamesByIds/)
})
test('A UK postcode district or street alone is not a delivery address',()=>{
 const {isPreciseDeliveryAddress}=load('lib/precise-delivery-address.ts')
 for(const bad of ['Birmingham B1, UK','Birmingham, B1 1AA, UK','Downing Street, London SW1A 2AA','52.4797, -1.9025',null])assert.equal(isPreciseDeliveryAddress(bad),false,String(bad))
 for(const good of ['10 Downing Street, London SW1A 2AA, UK','1 New Street, Birmingham B2 4AA','Buckingham Palace, London SW1A 1AA'])assert.equal(isPreciseDeliveryAddress(good),true,good)
 assert.match(read('app/actions/order-checkout.ts'),/isPreciseDeliveryAddress\(p.delivery_address\)/)
 assert.match(read('app/api/google/place/route.ts'),/geometry,formatted_address/)
})
test('A prepaid £50 shopping balance with £1.85 spent returns £48.15 through the idempotent card refund worker',async()=>{
 const jobs=[{key:'unused-shopping',amount:48.15,state:'queued'}], creates=[], recorded=[]
 const q={select:()=>q,or:()=>q,eq:async()=>({data:[{id:'payment',stripe_payment_intent:'pi_mock',refund_jobs:jobs}]})}
 const {processOrderRefunds}=load('lib/payments/direct.ts',{
  'server-only':{},'@/lib/notifications/internal':{},
  '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>q,rpc:async(name,args)=>{recorded.push({name,args});jobs[0].state='succeeded';return {error:null}}})},
  '@/lib/stripe/server':{getStripe:()=>({refunds:{list:async function*(){},create:async(params,options)=>{creates.push({params,options});return {id:'re_mock',status:'succeeded'}}}})},
 })
 await processOrderRefunds('order')
 await processOrderRefunds('order')
 assert.equal(creates.length,1)
 assert.equal(creates[0].params.amount,4815)
 assert.equal(creates[0].options.idempotencyKey,'refund:payment:unused-shopping')
 assert.equal(recorded[0].name,'record_order_refund')
 assert.equal(recorded[0].args.p_state,'succeeded')
})
