export type LaunchSettings = {
  shoppingEstimateMinutes: number
  baseFare: number
  includedMiles: number
  perMile: number
  shoppingFee: number
  maxProducts: number
  maxShoppingValue: number
  maxQuantityPerProduct: number
  maxShoppingWeightKg: number
  maxShoppingDimensionCm: number
  commissionPercent: number
  minimumDriverDelivery: number
  minimumDriverShopping: number
  freeWaitingMinutes: number
  waitingPerMinute: number
  vanCharge: number
  heavyCharge: number
  weatherMultiplier: number
  busyMultiplier: number
  deliveryCheckoutEnabled: boolean
  shoppingCheckoutEnabled: boolean
  areaName: string
  areaLat: number
  areaLng: number
  areaRadiusMiles: number
}
// Driver minimums are proposed launch defaults; admin must review before activation.
export const DEFAULT_LAUNCH_SETTINGS: LaunchSettings = {
  shoppingEstimateMinutes: 15,
  baseFare: 4.49,
  includedMiles: 2,
  perMile: 1.2,
  shoppingFee: 3.99,
  maxProducts: 5,
  maxShoppingValue: 100,
  maxQuantityPerProduct: 6,
  maxShoppingWeightKg: 10,
  maxShoppingDimensionCm: 60,
  commissionPercent: 20,
  minimumDriverDelivery: 4,
  minimumDriverShopping: 7,
  freeWaitingMinutes: 5,
  waitingPerMinute: 0,
  vanCharge: 0,
  heavyCharge: 0,
  weatherMultiplier: 1,
  busyMultiplier: 1,
  deliveryCheckoutEnabled: false,
  shoppingCheckoutEnabled: false,
  areaName: 'Manchester',
  areaLat: 53.4808,
  areaLng: -2.2426,
  areaRadiusMiles: 15,
}
export const roundMoney = (n: number) =>
  Math.round((n + Number.EPSILON) * 100) / 100
export function validateLaunchSettings(value: unknown): LaunchSettings {
  if (!value || typeof value !== 'object')
    throw new Error('Invalid pricing settings')
  const v = value as Record<string, unknown>,
    out = { ...DEFAULT_LAUNCH_SETTINGS }
  for (const key of Object.keys(out) as (keyof LaunchSettings)[]) {
    const current = v[key]
    if (current === undefined) continue
    if (typeof out[key] === 'number') {
      if (typeof current !== 'number' || !Number.isFinite(current))
        throw new Error(`Invalid ${key}`)
      if (
        !['areaLat', 'areaLng'].includes(key) &&
        (current < 0 || current > 10000)
      )
        throw new Error(`Invalid ${key}`)
    } else if (typeof out[key] === 'boolean') {
      if (typeof current !== 'boolean') throw new Error(`Invalid ${key}`)
    } else if (typeof current !== 'string' || current.length > 100)
      throw new Error(`Invalid ${key}`)
    Object.assign(out, { [key]: current })
  }
  if (
    out.baseFare < 1 ||
    out.shoppingFee < 0 ||
    out.maxShoppingValue < 1 ||
    out.maxShoppingValue > 100 ||
    out.maxProducts < 1 ||
    out.maxProducts > 5 ||
    !Number.isInteger(out.maxProducts) ||
    !Number.isInteger(out.maxQuantityPerProduct) ||
    out.maxQuantityPerProduct < 1 ||
    out.maxQuantityPerProduct > 20 ||
    out.commissionPercent > 100 ||
    out.weatherMultiplier < 1 ||
    out.busyMultiplier < 1 ||
    out.weatherMultiplier > 3 ||
    out.busyMultiplier > 3 ||
    out.freeWaitingMinutes < 5 ||
    Math.abs(out.areaLat) > 90 ||
    Math.abs(out.areaLng) > 180 ||
    out.areaRadiusMiles <= 0 ||
    out.maxShoppingWeightKg <= 0 ||
    out.maxShoppingDimensionCm <= 0
  )
    throw new Error('Check prices, limits, commission and service area')
  return out
}
export function deliveryFare(
  miles: number,
  s: LaunchSettings = DEFAULT_LAUNCH_SETTINGS,
) {
  if (!Number.isFinite(miles) || miles < 0)
    throw new Error('Invalid driving distance')
  return roundMoney(
    s.baseFare + Math.max(0, miles - s.includedMiles) * s.perMile,
  )
}
export function driverShare(
  serviceFees: number,
  shopping: boolean,
  s: LaunchSettings = DEFAULT_LAUNCH_SETTINGS,
) {
  if (!Number.isFinite(serviceFees) || serviceFees < 0)
    throw new Error('Invalid service fees')
  const amount = roundMoney(
    Math.max(
      serviceFees * (1 - s.commissionPercent / 100),
      shopping ? s.minimumDriverShopping : s.minimumDriverDelivery,
    ),
  )
  const commission = roundMoney(Math.max(0, serviceFees - amount)),
    subsidy = roundMoney(Math.max(0, amount - serviceFees))
  return { amount, commission, subsidy }
}
export function validateShoppingItems(
  items: { name: string; quantity: number; estimated_price?: number | null }[],
  s: LaunchSettings,
) {
  if (!Array.isArray(items) || items.length < 1 || items.length > s.maxProducts)
    throw new Error(`Add 1 to ${s.maxProducts} different products`)
  let total = 0
  const names = new Set<string>()
  for (const i of items) {
    const name = i.name?.trim().toLowerCase()
    if (!name || name.length > 200) throw new Error('Enter a valid item name')
    if (names.has(name))
      throw new Error('Combine quantities of the same product into one item')
    names.add(name)
    if (
      !Number.isInteger(i.quantity) ||
      i.quantity < 1 ||
      i.quantity > s.maxQuantityPerProduct
    )
      throw new Error(
        `Quantity must be 1–${s.maxQuantityPerProduct} per product`,
      )
    if (
      i.estimated_price == null ||
      !Number.isFinite(i.estimated_price) ||
      i.estimated_price < 0
    )
      throw new Error('Enter an estimated price for each product')
    total += i.estimated_price * i.quantity
  }
  total = roundMoney(total)
  if (total <= 0 || total > s.maxShoppingValue)
    throw new Error(
      `Shopping value must be between £0.01 and £${s.maxShoppingValue}`,
    )
  return total
}
export function inServiceArea(lat: number, lng: number, s: LaunchSettings) {
  if (
    !Number.isFinite(lat) ||
    !Number.isFinite(lng) ||
    Math.abs(lat) > 90 ||
    Math.abs(lng) > 180
  )
    return false
  const d = Math.PI / 180
  const a =
    Math.sin(((lat - s.areaLat) * d) / 2) ** 2 +
    Math.cos(lat * d) *
      Math.cos(s.areaLat * d) *
      Math.sin(((lng - s.areaLng) * d) / 2) ** 2
  return (
    3958.8 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a)) <= s.areaRadiusMiles
  )
}
