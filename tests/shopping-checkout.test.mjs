import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as nodeCrypto from 'node:crypto'

function compile(file, imports, extra = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(code,{exports,require:name=>{if(name==='@/lib/booking-availability')return{bookingAvailability:async()=>null};if(name==='@/lib/admin-access')return{getAdminActor:async()=>null,runAdminMutation:async(_scope,_event,_entity,work)=>work()};if(name==='@/lib/integration-health')return{recordHealth:async()=>{}};if(name in imports)return imports[name];if(name==='next/cache')return{revalidatePath:()=>{}};throw Error('Unmocked import '+name)},console,Date,Number,JSON,Math,Error,Buffer,crypto:nodeCrypto.webcrypto,...extra})
  return exports
}
function fixture() {
  let payment=null, sessions=0, reserves=0, balanceReads=0, sessionParams=null, quoteReads=0,expired=0
  const quote={totalCharge:67.87,totalFee:17.87,itemsHold:50,deliveryFee:13.88,serviceFee:3.99,distanceMiles:9.8,durationMin:30,priceLines:[]}
  const limits={maxShoppingProducts:15,maxQuantityPerProduct:10,maxShoppingWeightKg:15,maxShoppingDimensionCm:60}
  const consent=compile('lib/quote-consent.ts',{'server-only':{},'node:crypto':nodeCrypto},{process:{env:{SUPABASE_SERVICE_ROLE_KEY:'unit-test-quote-key'}}})
  const validation=compile('lib/shopping-validation.ts',{})
  const db={from(table){assert.equal(table,'payments','checkout must not read a wallet');const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:async()=>({data:payment,error:null}),single:async()=>({data:payment,error:null}),update(values){Object.assign(payment,values);return q},then(resolve){return Promise.resolve({error:null}).then(resolve)}};return q},async rpc(name,p){assert.equal(name,'reserve_order_checkout');assert.equal(p.p_funds_available,null);reserves++;payment={id:'payment-1',amount:p.p_amount,booking_draft:p.p_draft,created_at:new Date().toISOString(),status:'pending',customer_id:'customer'};return{error:null}}}
  const stripe={balance:{retrieve(){balanceReads++;throw Error('Issuing balance is not needed for customer checkout')}},checkout:{sessions:{async create(p,key){sessions++;sessionParams=p;assert.equal(key.idempotencyKey,'booking:payment-1');return{id:'cs_test',url:'https://checkout.stripe.test/session'}},async expire(){expired++;return{status:'expired'}},async retrieve(){return{id:'cs_test',status:'open',url:'https://checkout.stripe.test/session'}}}}}
  const api=compile('app/actions/order-checkout.ts',{'@/app/actions/cancellation':{},
    'node:crypto':nodeCrypto,
    '@/lib/short-request':{boundedFetch:()=>fetch},
    '@/lib/parcel-contact':compile('lib/parcel-contact.ts',{'./uk-phone':compile('lib/uk-phone.ts',{})}),
    '@/lib/precise-delivery-address':compile('lib/precise-delivery-address.ts',{}),
    '@/lib/order-photo-lifecycle':{leaseOrderPhotos:async()=>true},
    '@/lib/order-media':compile('lib/order-media.ts',{}, {URL,process:{env:{NEXT_PUBLIC_SUPABASE_URL:'https://example.supabase.co'}}}),
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'customer',email:'test@example.test'}}})}})},
    '@/lib/supabase/admin':{createAdminClient:()=>db},
    '@/lib/stripe/server':{getStripe:()=>stripe,isStripeConfigured:()=>true},
    '@/lib/get-app-origin':{getAppOrigin:async()=>'https://godrop.example'},
    '@/app/actions/booking-settings':{getBookingPricing:async()=>limits},
    '@/app/actions/pricing':{getDeliveryQuote:async()=>{quoteReads++;throw Error('Unreviewed route recalculation')}},
    '@/app/actions/shopping':{getBfmSettings:async()=>({enabled:true,max_purchase_amount:50}),getShoppingQuote:async()=>{quoteReads++;return {data:quote}}},
    '@/lib/shopping-validation':validation,
    '@/lib/shopping-booking':compile('lib/shopping-booking.ts',{}),
    '@/lib/vehicles':compile('lib/vehicles.ts',{}),
    '@/lib/quote-consent':consent,
    '@/lib/payments/direct':{},
  })
  const requestKey='00000000-0000-4000-8000-000000000001'
  const input={requestKey,type:'buy_for_me',order:{request_key:requestKey,limits_acknowledged:true,shop_name:'Test shop',shop_address:'Shop address',shop_lat:53.48,shop_lng:-2.24,delivery_address:'Delivery address',delivery_lat:53.49,delivery_lng:-2.25,shopping_items:Array.from({length:15},(_,i)=>({name:'Item '+(i+1),quantity:1,estimated_price:null,substitution_preference:'contact_me'}))}}
  input.order.consent_token=consent.issueQuoteConsent('customer',consent.shoppingScope({...input.order,estimated_items_total:0}),quote.totalCharge)
  return{api,input,consent,quote,get quoteReads(){return quoteReads},get expired(){return expired},get sessions(){return sessions},get reserves(){return reserves},get balanceReads(){return balanceReads},get params(){return sessionParams},get payment(){return payment}}
}
test('Fifteen-product card checkout works without a wallet or available company Issuing funds',async()=>{
  const f=fixture(),result=await f.api.startOrderCheckout(f.input)
  assert.equal(result.url,'https://checkout.stripe.test/session');assert.equal(f.balanceReads,0)
  assert.equal(f.payment.booking_draft.shopping_items.length,15)
  assert.equal(f.params.line_items.reduce((sum,i)=>sum+i.price_data.unit_amount*i.quantity,0),6787)
  assert.equal(f.payment.status,'pending','booking is not dispatched before confirmed payment')
})
test('Retrying the same shopping checkout reuses the existing Stripe session',async()=>{
  const f=fixture();await f.api.startOrderCheckout(f.input);await f.api.startOrderCheckout(f.input)
  assert.equal(f.sessions,1);assert.equal(f.reserves,1)
})
test('Invalid quote consent still prevents shopping checkout before a Stripe session is created',async()=>{
  const f=fixture();f.input.order.consent_token='invalid'
  assert.match((await f.api.startOrderCheckout(f.input)).error,/Quote changed or expired/)
  assert.equal(f.sessions,0);assert.equal(f.reserves,0)
})
test('A customer cannot attach another account item photo to card checkout',async()=>{
 const f=fixture();f.input.order.shopping_items[0].photo_url='https://example.supabase.co/storage/v1/object/public/delivery-item-photos/another-account/private.jpg';
 assert.match((await f.api.startOrderCheckout(f.input)).error,/own item photos/);assert.equal(f.sessions,0);assert.equal(f.reserves,0)
})

test('Unconfirmed shopping limits stop checkout before any payment reservation',async()=>{const f=fixture();f.input.order.limits_acknowledged=false;assert.match((await f.api.startOrderCheckout(f.input)).error,/Confirm the shopping limits/);assert.equal(f.reserves,0);assert.equal(f.sessions,0)})

test('QA19: Buy for Me charges the reviewed signed snapshot even if a new route would quote more',async()=>{
 const f=fixture();const snapshot=structuredClone(f.quote)
 f.input.order.consent_token=f.consent.issueQuoteConsent('customer',f.consent.shoppingScope({...f.input.order,estimated_items_total:0}),snapshot.totalCharge,snapshot)
 f.quote.totalCharge=99;f.quote.totalFee=49
 assert.ok((await f.api.startOrderCheckout(f.input)).url)
 assert.equal(f.quoteReads,0)
 assert.equal(f.params.line_items.reduce((sum,i)=>sum+i.price_data.unit_amount*i.quantity,0),6787)
})

test('QA19: parcel review £6.10 creates a £6.10 GBP Checkout without rerouting or losing the recipient zero',async()=>{
 const f=fixture()
 const order={pickup_address:'10 Downing Street, London SW1A 2AA',pickup_lat:51.503,pickup_lng:-0.127,delivery_address:'221B Baker Street, London NW1 6XE',delivery_lat:51.523,delivery_lng:-0.158,recipient_name:'QA Recipient',recipient_phone:'07700900456',collection_at:'asap',package_size:'small',item_photo_urls:[]}
 const scope=f.consent.deliveryScope({pickupLat:order.pickup_lat,pickupLng:order.pickup_lng,deliveryLat:order.delivery_lat,deliveryLng:order.delivery_lng,packageSize:order.package_size})
 order.consent_token=f.consent.issueQuoteConsent('customer',scope,6.1,{finalPrice:6.1,basePrice:6.1,surgeMultiplier:1,discountAmount:0,distanceMiles:3.34,durationMin:15,priceLines:[]})
 const result=await f.api.startOrderCheckout({requestKey:f.input.requestKey,type:'delivery',order})
 assert.ok(result.url);assert.equal(f.quoteReads,0);assert.equal(f.params.line_items[0].price_data.unit_amount,610);assert.equal(f.params.line_items[0].price_data.currency,'gbp')
})

test('QA19: an older open checkout with another total is expired, never silently resumed',async()=>{
 const f=fixture();const scope=f.consent.shoppingScope({...f.input.order,estimated_items_total:0})
 f.input.order.consent_token=f.consent.issueQuoteConsent('customer',scope,f.quote.totalCharge,structuredClone(f.quote))
 await f.api.startOrderCheckout(f.input)
 const revised={...f.quote,totalFee:18.5,totalCharge:68.5}
 f.input.order.consent_token=f.consent.issueQuoteConsent('customer',scope,revised.totalCharge,revised)
 const result=await f.api.startOrderCheckout(f.input)
 assert.equal(result.restartCheckout,true);assert.match(result.error,/different total/);assert.equal(f.expired,1);assert.equal(f.sessions,1)
})

test('QA19: a signed quote is bound to the customer, route, size and promo, and lasts exactly ten minutes',()=>{
 let now=1000
 const api=compile('lib/quote-consent.ts',{'server-only':{},'node:crypto':nodeCrypto},{process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test-key'}},Date:{now:()=>now}})
 const scope=api.deliveryScope({pickupLat:51,pickupLng:0,deliveryLat:52,deliveryLng:1,packageSize:'small',promoCode:'HELLO'})
 const token=api.issueQuoteConsent('customer',scope,6.1,{finalPrice:6.1})
 now+=599999;assert.equal(api.readQuoteConsent(token,'customer',scope).amount,6.1)
 assert.equal(api.checkQuoteConsent(undefined,'customer',scope,undefined),false)
 assert.equal(api.readQuoteConsent(token+'.extra','customer',scope),null)
 assert.equal(api.readQuoteConsent(token,'other',scope),null);assert.equal(api.readQuoteConsent(token,'customer',[...scope,'changed']),null)
 const payload=JSON.parse(Buffer.from(token.split('.')[0],'base64url').toString());payload.amount=0.01
 assert.equal(api.readQuoteConsent(Buffer.from(JSON.stringify(payload)).toString('base64url')+'.'+token.split('.')[1],'customer',scope),null)
 now++;assert.equal(api.readQuoteConsent(token,'customer',scope),null)
})

test('Buy for Me saves the selected size and does not accept a quote signed for another size', async () => {
  const f = fixture()
  f.input.order.package_size = 'large'
  assert.match((await f.api.startOrderCheckout(f.input)).error, /Quote changed or expired/)
  assert.equal(f.reserves, 0)
  const scope = f.consent.shoppingScope(f.input.order)
  const snapshot = { ...f.quote, packageSize: 'large', totalFee: 11.98, itemsHold: 3, totalCharge: 14.98 }
  f.input.order.consent_token = f.consent.issueQuoteConsent('customer', scope, snapshot.totalCharge, snapshot)
  assert.equal((await f.api.startOrderCheckout(f.input)).url, 'https://checkout.stripe.test/session')
  assert.equal(f.payment.booking_draft.package_size, 'large')
  assert.equal(f.payment.booking_draft.max_spend_approved, 3)
  assert.equal(f.params.line_items.reduce((sum, i) => sum + i.price_data.unit_amount * i.quantity, 0), 1498)
})

test('Buy for Me normalises the optional recipient number before reserving card checkout',async()=>{
 const bad=fixture()
 bad.input.order.recipient_phone='+92 300 1234567'
 assert.match((await bad.api.startOrderCheckout(bad.input)).error,/valid UK phone/)
 assert.equal(bad.reserves,0)
 const good=fixture()
 good.input.order.recipient_phone='07928 922369'
 assert.equal((await good.api.startOrderCheckout(good.input)).url,'https://checkout.stripe.test/session')
 assert.equal(good.payment.booking_draft.recipient_phone,'+447928922369')
 const blank=fixture()
 await blank.api.startOrderCheckout(blank.input)
 assert.equal(blank.payment.booking_draft.recipient_phone,null)
})
