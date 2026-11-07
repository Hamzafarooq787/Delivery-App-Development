import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
import * as crypto from 'node:crypto'
import * as jsx from 'react/jsx-runtime'
import { PGlite } from '@electric-sql/pglite'

const read = path => fs.readFileSync(path, 'utf8')
const json = value => JSON.parse(JSON.stringify(value))
function load(file, imports = {}, extra = {}) {
  const exports = {}
  const code = ts.transpileModule(read(file), { compilerOptions: {
    module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX,
  }}).outputText
  vm.runInNewContext(code, { exports, require: name => name === 'react/jsx-runtime' ? jsx : imports[name] ?? {}, Date, Intl, Buffer, ...extra })
  return exports
}

test('A registered bicycle stays usable when a motorcycle is missing an insurance expiry', () => {
  const { driverDispatchReadiness } = load('lib/driver-compliance.ts')
  const vehicles = [{ vehicle_type: 'bicycle' }, { vehicle_type: 'motorcycle' }]
  const documents = ['identity','selfie','insurance','vehicle_registration'].map(document_type => ({ document_type, expires_on: null, review_status: 'pending' }))
  const result = driverDispatchReadiness(vehicles, documents, '2026-11-08')
  assert.deepEqual(json(result.eligible), [vehicles[0]])
  assert.match(result.message, /expiry date for your motor insurance/)
  documents[2].expires_on = '2026-11-07'
  assert.match(driverDispatchReadiness(vehicles, documents, '2026-11-08').message, /expired motor insurance/)
  documents[2].expires_on = '2026-11-08'
  assert.deepEqual(json(driverDispatchReadiness(vehicles, documents, '2026-11-08').eligible), vehicles)
  documents[0].review_status = 'rejected'
  assert.equal(driverDispatchReadiness(vehicles, documents, '2026-11-08').eligible.length, 0)
})

test('Database dispatch and atomic claims match the valid vehicle, and the QA order correction preserves money', async () => {
  const db = new PGlite()
  const order = '8ab40490-97c6-4f82-98a3-5866eac85aaa'
  const driver = '00000000-0000-4000-8000-000000000027'
  const medium = '00000000-0000-4000-8000-000000000028'
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role;
      create table users(id uuid, role text, account_status text);
      create table driver_profiles(id uuid,status text,is_online boolean,delivery_alerts boolean,notifications_enabled boolean,verification_submitted_at timestamptz);
      create table driver_vehicles(driver_id uuid,vehicle_type text);
      create table driver_documents(driver_id uuid,document_type text,review_status text,expires_on date);
      create table delivery_requests(id uuid,tracking_number text,service_type text,status text,driver_id uuid,package_size text,estimated_items_total numeric,max_spend_approved numeric,recovery_case jsonb,pickup_lat numeric,pickup_lng numeric,delivery_lat numeric,delivery_lng numeric,price numeric);
      create table payments(delivery_id uuid,purpose text,payment_method text,status text,amount numeric);
      create table shopping_items(delivery_id uuid,quantity integer,estimated_price numeric,name text);
      create table notifications(user_id uuid,title text,body text,action_url text,created_at timestamptz default now());
      create function guard_driver_claim_compliance() returns trigger language plpgsql as 'begin return new; end;';
      create trigger guard_driver_claim_compliance before update on delivery_requests for each row execute function guard_driver_claim_compliance();
      create trigger guard_expired_driver_claim before update on delivery_requests for each row execute function guard_driver_claim_compliance();
      insert into users values ('${driver}','driver','active');
      insert into driver_profiles values ('${driver}','approved',true,true,true,null);
      insert into driver_vehicles values ('${driver}','bicycle'),('${driver}','motorcycle');
      insert into driver_documents values ('${driver}','identity','pending',null),('${driver}','selfie','pending',null),('${driver}','insurance','pending',null),('${driver}','vehicle_registration','pending',null);
      insert into delivery_requests values ('${order}','GD-C850BAC3','buy_for_me','requested',null,'medium',2,50,null,53.46,-2.18,53.47,-2.19,8.48),
        ('${medium}','GD-MEDIUM','buy_for_me','requested',null,'medium',2,50,null,53.46,-2.18,53.47,-2.19,9.98);
      insert into payments values ('${order}','booking','stripe','paid',58.48),('${medium}','booking','stripe','paid',59.98);
      insert into shopping_items values ('${order}',1,2,'1x milk 2L');
    `)
    await db.exec(read('supabase/migrations/20261107194330_r27_vehicle_dispatch_and_test_order.sql'))
    const result = (await db.query('select d.package_size,d.price,d.max_spend_approved,d.status,p.amount from delivery_requests d join payments p on p.delivery_id=d.id where d.id=$1',[order])).rows[0]
    assert.deepEqual(result,{package_size:'small',price:'8.48',max_spend_approved:'50',status:'requested',amount:'58.48'})
    const eligible = async id => (await db.query('select eligible_delivery_drivers($1) as ids',[id])).rows[0].ids
    assert.deepEqual(await eligible(order),[driver])
    assert.deepEqual(await eligible(medium),[])
    await assert.rejects(db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[driver,medium]), /driver_documents_incomplete/)
    await db.query("update driver_documents set expires_on=current_date-2 where document_type='insurance'")
    await db.query('select driver_compliance_reminders()')
    assert.equal((await db.query('select status from driver_profiles')).rows[0].status,'approved')
    assert.deepEqual(await eligible(order),[driver])
    await db.query("update delivery_requests set driver_id=$1,status='accepted' where id=$2",[driver,order])
    assert.equal((await db.query('select driver_id from delivery_requests where id=$1',[order])).rows[0].driver_id,driver)
    assert.equal((await db.query("select has_function_privilege('authenticated','driver_dispatch_sizes(uuid)','execute') as allowed")).rows[0].allowed,false)
  } finally { await db.close() }
})

test('Shopping quote uses the chosen fee, estimate and capped buffer and signs their shared ten-minute expiry', async () => {
  let now = 1_800_000_000_000
  const date = class extends Date { static now() { return now } }
  const consent = load('lib/quote-consent.ts', { 'node:crypto': crypto }, { Date: date, process:{env:{SUPABASE_SERVICE_ROLE_KEY:'test'}} })
  const pricing = load('lib/booking-pricing.ts')
  const funds = load('lib/shopping-booking.ts')
  const config = pricing.withParcelPricing(pricing.DEFAULT_BOOKING_PRICING)
  const app = load('app/actions/shopping.ts', {
    '@/lib/quote-consent':consent,'@/lib/shopping-booking':funds,'@/lib/vehicles':load('lib/vehicles.ts'),
    '@/lib/supabase/server':{createClient:async()=>({auth:{getUser:async()=>({data:{user:{id:'customer'}}})}})},
    '@/lib/supabase/admin':{createAdminClient:()=>({from:()=>({select:()=>({single:async()=>({data:{enabled:true,max_purchase_amount:50,service_fee_percentage:0}})})})})},
    '@/lib/shopping-validation':load('lib/shopping-validation.ts'),
    '@/app/actions/booking-settings':{getBookingPricing:async()=>config},
    '@/app/actions/pricing':{getDeliveryQuote:async({packageSize})=>{const fare=pricing.calculateDeliveryFare(0.96,config,packageSize);return {data:{basePrice:fare,finalPrice:fare,surgeMultiplier:1,priceLines:pricing.fareBreakdown(0.96,config,packageSize),distanceMiles:0.96}}}},
  },{Date:date})
  const basket = { shop_lat:53.46,shop_lng:-2.18,delivery_lat:53.47,delivery_lng:-2.19,estimated_items_total:2,all_items_estimated:true }
  for (const [size,total] of [['small',11.48],['medium',12.98],['large',14.98],['bulky',21.48]]) {
    const params={...basket,package_size:size}
    const {data:quote}=await app.getShoppingQuote(params)
    assert.equal(quote.totalCharge,total)
    assert.equal(quote.itemsHold,3)
    assert.equal(quote.shoppingBuffer,1)
    assert.equal(quote.expiresAt,now+600000)
    assert.equal(consent.readQuoteConsent(quote.consentToken,'customer',consent.shoppingScope(params)).expires,quote.expiresAt)
    assert.equal(consent.readQuoteConsent(quote.consentToken,'customer',consent.shoppingScope({...params,all_items_estimated:false})),null)
    now=quote.expiresAt
    assert.equal(consent.readQuoteConsent(quote.consentToken,'customer',consent.shoppingScope(params)),null)
  }
  const {data:fallback}=await app.getShoppingQuote({...basket,all_items_estimated:false})
  assert.equal(fallback.totalCharge,58.48)
  assert.deepEqual(json(funds.shoppingFunds(49.85,50,true)),{itemsHold:50,shoppingBuffer:0.15})
  const lock=load('components/customer/quote-lock.tsx').QuoteLock({expiresAt:fallback.expiresAt})
  assert.match(lock.props.children[0],/Price locked for 10 minutes/)
  assert.equal(lock.props.children[1].props.dateTime,new Date(fallback.expiresAt).toISOString())
})
