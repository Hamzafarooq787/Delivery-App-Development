/** Ordinary bookings are not saved. Keep only intentional payment-return recovery. */
export function discardAbandonedBookingDrafts(storage: Pick<Storage, 'length' | 'key' | 'removeItem'>, kind: string) {
  const keys: string[] = []
  for (let index = 0; index < storage.length; index++) {
    const key = storage.key(index)
    if (key?.startsWith('godrop-booking:') && key.endsWith(`:${kind}`)) keys.push(key)
  }
  for (const key of keys) storage.removeItem(key)
  if (kind === 'delivery') storage.removeItem('godrop_pending_delivery_draft')
}
