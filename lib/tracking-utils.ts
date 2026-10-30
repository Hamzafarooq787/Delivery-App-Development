export const ACTIVE_DELIVERY_STATUSES = ['accepted', 'collected', 'picked_up', 'in_transit']
export function isFreshLocation(timestamp: string | number | null | undefined, now = Date.now()): boolean {
  const time = typeof timestamp === 'number' ? timestamp : Date.parse(timestamp ?? '')
  return Number.isFinite(time) && time <= now + 5000 && now - time < 45000
}
export function goesToDestination(status?: string, stage?: string | null): boolean {
  if (stage) return ['purchase_completed', 'heading_to_customer'].includes(stage)
  return ['collected', 'picked_up', 'in_transit', 'delivered'].includes(status ?? '') || ['purchase_completed', 'delivering', 'delivered'].includes(stage ?? '')
}
