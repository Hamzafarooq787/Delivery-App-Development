export type BookingPricing = {
  maxShoppingProducts: number
  maxQuantityPerProduct: number
  maxShoppingWeightKg: number
  maxShoppingDimensionCm: number
  commissionPercent: number
  minimumDriverEarnings: number
  baseFare: number
  includedMiles: number
  perMile: number
  shoppingFee: number
  largeFee: number
  vanFee: number
  weatherFee: number
  serviceRadiusMiles: number
}
export const DEFAULT_BOOKING_PRICING: BookingPricing = { maxShoppingProducts:5, maxQuantityPerProduct:10, maxShoppingWeightKg:15, maxShoppingDimensionCm:60, commissionPercent: 20, minimumDriverEarnings: 4.49, baseFare: 4.49, includedMiles: 2, perMile: 1.2, shoppingFee: 3.99, largeFee: 0, vanFee: 0, weatherFee: 0, serviceRadiusMiles: 0 }
export function validateBookingPricing(value: unknown): value is BookingPricing {
  if (!value || typeof value !== 'object') return false
  const v = value as Record<string, unknown>
  return Object.keys(DEFAULT_BOOKING_PRICING).every(k => typeof v[k] === 'number' && Number.isFinite(v[k]) && (v[k] as number) >= 0 && (v[k] as number) <= 500) && ['baseFare','perMile','shoppingFee','largeFee','vanFee','weatherFee','minimumDriverEarnings'].every(k=>Math.abs(Math.round(Number(v[k])*100)-Number(v[k])*100)<1e-7) && (v.baseFare as number) > 0 && (v.commissionPercent as number) <= 100 && Number.isInteger(v.maxShoppingProducts) && (v.maxShoppingProducts as number)>=1 && (v.maxShoppingProducts as number)<=5 && Number.isInteger(v.maxQuantityPerProduct) && (v.maxQuantityPerProduct as number)>=1 && (v.maxQuantityPerProduct as number)<=99 && (v.maxShoppingWeightKg as number)>0 && (v.maxShoppingDimensionCm as number)>0
}
export function calculateDeliveryFare(miles: number, config: BookingPricing, size = 'small'): number {
  if (!Number.isFinite(miles) || miles < 0 || !validateBookingPricing(config)) throw new Error('Invalid pricing input')
  const extra = size === 'bulky' ? config.vanFee : size === 'large' ? config.largeFee : 0
  return Math.round((config.baseFare + Math.max(0, miles - config.includedMiles) * config.perMile + extra + config.weatherFee) * 100) / 100
}
export function inServiceArea(lat: number, lng: number, radiusMiles: number): boolean {
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || Math.abs(lat) > 90 || Math.abs(lng) > 180) return false
  if (!radiusMiles) return true // Existing unrestricted service until admin defines the launch boundary.
  const rad = Math.PI / 180
  const a = Math.sin((lat - 53.4808) * rad / 2) ** 2 + Math.cos(lat * rad) * Math.cos(53.4808 * rad) * Math.sin((lng + 2.2426) * rad / 2) ** 2
  return 3958.7613 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= radiusMiles
}

export function fareBreakdown(miles:number,config:BookingPricing,size='small'){
 const round=(n:number)=>Math.round(n*100)/100
 const lines=[{label:`First ${config.includedMiles} miles`,amount:config.baseFare},{label:'Additional driving distance',amount:round(Math.max(0,miles-config.includedMiles)*config.perMile)}]
 const sizeFee=size==='bulky'?config.vanFee:size==='large'?config.largeFee:0
 if(sizeFee)lines.push({label:size==='bulky'?'Van surcharge':'Large item surcharge',amount:sizeFee})
 if(config.weatherFee)lines.push({label:'Weather surcharge',amount:config.weatherFee})
 return lines.filter(line=>line.amount>0)
}
