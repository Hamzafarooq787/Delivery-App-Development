import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as nodeCrypto from 'node:crypto'

function compile(file, imports, extra = {}) {
  const exports = {}
  const code = ts.transpileModule(fs.readFileSync(file,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2020}}).outputText
  vm.runInNewContext(code,{exports,require:name=>{if(name in imports)return imports[name];throw Error('Unmocked import '+name)},console,Date,Number,JSON,Math,Error,Buffer,crypto:nodeCrypto.webcrypto,...extra})
  return exports
}
function fixture() {
  let payment=null, sessions=0, reserves=0, balanceReads=0, sessionParams=null
  const quote={totalCharge:67.87,totalFee:17.87,itemsHold:50,deliveryFee:13.88,serviceFee:3.99,distanceMiles:9.8,durationMin:30,priceLines:[]}
  const limits={maxShoppingProducts:15,maxQuantityPerProduct:10,maxShoppingWeightKg:15,maxShoppingDimensionCm:60}
  const consent=compile('lib/quote-consent.ts',{'server-only':{},'node:crypto':nodeCrypto},{process:{env:{SUPABASE_SERVICE_ROLE_KEY:'unit-test-quote-key'}}})
  const validation=compile('lib/shopping-validation.ts',{})
  const db={from(table){assert.equal(table,'payments','checkout must not read a wallet');const q={select:()=>q,eq:()=>q,is:()=>q,maybeSingle:async()=>({data:payment,error:null}),single:async()=>({data:payment,error:null}),update(values){Object.assign(payment,values);return q},then(resolve){return Promise.resolve({error:null}).then(resolve)}};return q},async rpc(name,p){assert.equal(name,'reserve_order_checkout');assert.equal(p.p_funds_available,null);reserves++;payment={id:'payment-1',amount:p.p_amount,booking_draft:p.p_draft,created_at:new Date().toISOString(),status:'pending',customer_id:'customer'};return{error:null}}}
  const stripe={balance:{retrieve(){balanceReads++;throw Error('Issuing balance is not needed for customer checkout')}},checkout:{sessions:{async create(p,key){sessions++;sessionParams=p;assert.equal(key.idempotencyKey,'booking:payment-1');return{id:'cs_test',url:'https://checkout.stripe.test/session'}},async retrieve(){return{status:'open',url:'https://checkout.stripe.test/session'}}}}}
  const api=compile('app/actions/order-checkout.ts',{
    'node:crypto':nodeCrypto,
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'customer',email:'test@example.test'}}})}})},
    '@/lib/supabase/admin':{createAdminClient:()=>db},
    '@/lib/stripe/server':{getStripe:()=>stripe,isStripeConfigured:()=>true},
    '@/lib/get-app-origin':{getAppOrigin:async()=>'https://godrop.example'},
    '@/app/actions/booking-settings':{getBookingPricing:async()=>limits},
    '@/app/actions/pricing':{},
    '@/app/actions/shopping':{getBfmSettings:async()=>({enabled:true,max_purchase_amount:50}),getShoppingQuote:async()=>({data:quote})},
    '@/lib/shopping-validation':validation,
    '@/lib/quote-consent':consent,
    '@/lib/payments/direct':{},
  })
  const requestKey='00000000-0000-4000-8000-000000000001'
  const input={requestKey,type:'buy_for_me',order:{request_key:requestKey,limits_acknowledged:true,shop_name:'Test shop',shop_address:'Shop address',shop_lat:53.48,shop_lng:-2.24,delivery_address:'Delivery address',delivery_lat:53.49,delivery_lng:-2.25,shopping_items:Array.from({length:15},(_,i)=>({name:'Item '+(i+1),quantity:1,estimated_price:null,substitution_preference:'contact_me'}))}}
  input.order.consent_token=consent.issueQuoteConsent('customer',[53.48,-2.24,53.49,-2.25,0],quote.totalCharge)
  return{api,input,get sessions(){return sessions},get reserves(){return reserves},get balanceReads(){return balanceReads},get params(){return sessionParams},get payment(){return payment}}
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
