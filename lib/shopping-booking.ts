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
