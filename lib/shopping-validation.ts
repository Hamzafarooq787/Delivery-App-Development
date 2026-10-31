export function normalizeBfmSettings(row: Record<string, unknown>) {
  const maximum = Number(row.max_purchase_amount)
  const fee = Number(row.service_fee_percentage)
  if (!Number.isFinite(maximum) || maximum <= 0 || maximum > 100 || !Number.isFinite(fee) || fee < 0 || fee > 100) throw new Error('Invalid shopping configuration')
  return { enabled: row.enabled === true || (row.enabled == null && row.service_enabled === true), max_purchase_amount: maximum, service_fee_percentage: fee }
}

export function validateShoppingItems(items: unknown, limits={maxShoppingProducts:15,maxQuantityPerProduct:10}): string | null {
  if (!Array.isArray(items) || items.length < 1 || items.length > limits.maxShoppingProducts) return `Add between 1 and ${limits.maxShoppingProducts} different products.`
  for (const item of items) {
    if (!item || typeof item.name !== 'string' || !item.name.trim() || item.name.length > 200) return 'Enter a valid name for each product.'
    if (!Number.isInteger(item.quantity) || item.quantity < 1 || item.quantity > limits.maxQuantityPerProduct) return `Each quantity must be a whole number from 1 to ${limits.maxQuantityPerProduct}.`
    if (item.estimated_price != null && (!Number.isFinite(item.estimated_price) || item.estimated_price < 0 || item.estimated_price > 100)) return 'Enter a valid estimated price.'
    if (!['contact_me', 'best_alternative', 'skip_if_unavailable'].includes(item.substitution_preference)) return 'Choose a valid replacement preference.'
  }
  return null
}
