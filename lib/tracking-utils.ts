export const ACTIVE_DELIVERY_STATUSES = ['accepted', 'collected', 'picked_up', 'in_transit']
/** Supabase's location tables can return UTC timestamps without an offset. */
export function locationTimestamp(timestamp: string | number | null | undefined): number {
  if (typeof timestamp === 'number') return timestamp
  if (!timestamp) return NaN
  timestamp = timestamp.trim().replace(" ", "T")
  if (/(?:Z|[+-]\d{2}:?\d{2})$/i.test(timestamp)) return Date.parse(timestamp)
  if (/[:T].*[+-]\d{2}$/.test(timestamp)) return Date.parse(timestamp + ':00')
  return Date.parse(timestamp + 'Z')
}
export function isFreshLocation(timestamp: string | number | null | undefined, now = Date.now()): boolean {
  const time = locationTimestamp(timestamp)
  return Number.isFinite(time) && time <= now + 5000 && now - time < 45000
}
export function goesToDestination(status?: string, stage?: string | null): boolean {
  if (stage) return ['purchase_completed', 'heading_to_customer'].includes(stage)
  return ['collected', 'picked_up', 'in_transit', 'delivered'].includes(status ?? '') || ['purchase_completed', 'delivering', 'delivered'].includes(stage ?? '')
}

export function terminalTrackingStatus(status?: string) {
  if (status === 'delivered') return 'Delivered'
  if (status === 'cancelled') return 'Cancelled'
  return null
}
