import type { ShoppingItem } from '@/app/actions/shopping'

/** randomUUID is missing in older browsers; retain cryptographic UUIDs there. */
export function newShoppingRequestId(): string {
  if (typeof crypto.randomUUID === 'function') return crypto.randomUUID()
  const bytes = crypto.getRandomValues(new Uint8Array(16))
  bytes[6] = (bytes[6] & 15) | 64
  bytes[8] = (bytes[8] & 63) | 128
  const hex = Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('')
  return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`
}

/** Keep the estimate identical to the existing server's signed quote scope. */
export function shoppingEstimate(items: ShoppingItem[]): number {
  return items.reduce((sum, item) => sum + (item.estimated_price ?? 0) * item.quantity, 0)
}

export function duplicateShoppingProduct(items: ShoppingItem[], candidate: ShoppingItem): boolean {
  const key = (item: ShoppingItem) => [item.name, item.brand_size_variant ?? ''].map(s => s.trim().replace(/\s+/g, ' ').toLocaleLowerCase('en-GB')).join('|')
  return items.some(item => key(item) === key(candidate))
}

export function shoppingQuoteInputs(items: ShoppingItem[]) {
  return {
    estimated_items_total: shoppingEstimate(items),
    all_items_estimated: items.length > 0 && items.every(item => Number.isFinite(item.estimated_price) && (item.estimated_price ?? 0) > 0),
  }
}

/** Unpriced items retain the approved budget. Fully estimated baskets need only
 * the estimate and a small buffer, capped by the admin's spending limit. */
export function shoppingFunds(estimate: number, maximum: number, allItemsEstimated: boolean) {
  const cents = Math.round(estimate * 100)
  const cap = Math.floor(maximum * 100 + 1e-7)
  const prepaid = allItemsEstimated && cents > 0 ? Math.min(cap, cents + Math.max(100, Math.ceil(cents / 5))) : cap
  return { itemsHold: prepaid / 100, shoppingBuffer: Math.max(0, prepaid - cents) / 100 }
}

export function shoppingAddressProblem(label: string, value: string, place: { address: string; lat: number; lng: number } | null) {
  if (!value.trim()) return `Enter the ${label}.`
  if (!place || place.address !== value || !Number.isFinite(place.lat) || !Number.isFinite(place.lng) ||
      Math.abs(place.lat) > 90 || Math.abs(place.lng) > 180) {
    return `Confirm the ${label} by selecting a suggestion or choosing a point on the map.`
  }
  return ''
}
