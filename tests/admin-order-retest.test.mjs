import test from 'node:test'
import assert from 'node:assert/strict'
import {readFileSync} from 'node:fs'
import vm from 'node:vm'
import ts from 'typescript'
function load(path) {
  const exports={}
  vm.runInNewContext(ts.transpileModule(readFileSync(path,'utf8'),{compilerOptions:{module:ts.ModuleKind.CommonJS,target:ts.ScriptTarget.ES2022}}).outputText,{exports})
  return exports
}
test('Waleed’s 3-mile example uses the new parcel-size prices and preserves an explicit zero',()=>{
  const {DEFAULT_BOOKING_PRICING,withParcelPricing,calculateDeliveryFare,fareBreakdown}=load('lib/booking-pricing.ts')
  const config=withParcelPricing({...DEFAULT_BOOKING_PRICING,largeFee:0,vanFee:0})
  for(const [size,price,fee] of [['small',5.69,0],['medium',7.19,1.5],['large',9.19,3.5],['bulky',15.69,10]]) {
    assert.equal(calculateDeliveryFare(3,config,size),price)
    assert.equal(fareBreakdown(3,config,size).find(l=>l.label==='Parcel size surcharge')?.amount??0,fee)
  }
  assert.equal(calculateDeliveryFare(3,withParcelPricing({...config,mediumFee:0,largeFee:0}),'large'),5.69)
})
test('Admin can display partial, complete and pending refunds without changing paid dispatch state',()=>{
 const {paymentDisplayStatus}=load('lib/payment-display.ts')
 assert.equal(paymentDisplayStatus('paid',5.39,[{amount:5.39,state:'succeeded'}]),'refunded')
 assert.equal(paymentDisplayStatus('paid',5.39,[{amount:2,state:'succeeded'},{amount:3.39,state:'pending'}]),'partially_refunded')
 assert.equal(paymentDisplayStatus('paid',5.39,[{amount:5.39,state:'pending'}]),'refund_pending')
})
test('Van-size stays compatible with the persisted bulky key and van-only matching',()=>{
 const {isPackageSize,PACKAGE_SIZE_INFO,unionCapabilities}=load('lib/vehicles.ts')
 assert.equal(isPackageSize('bulky'),true)
 assert.equal(PACKAGE_SIZE_INFO.bulky.label,'Van-size')
 assert.equal(unionCapabilities(['bicycle','motorcycle','car']).includes('bulky'),false)
 assert.equal(unionCapabilities(['van']).includes('bulky'),true)
})
