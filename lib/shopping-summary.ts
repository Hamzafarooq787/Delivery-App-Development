export type RefundRecord = { key?: string; amount: number; state: string }
export type ShoppingFinancialOrder = { price: number | null; max_spend_approved: number | null; actual_items_total?: number | null; shopping_hold_settled_at?: string | null; payment_method?: string | null }
export function shoppingFinancials(order: ShoppingFinancialOrder, payment?: { amount: number; refund_jobs?: RefundRecord[]; payment_method?: string } | null) {
  const fees = Number(order.price ?? 0), prepaid = Number(order.max_spend_approved ?? 0)
  const charged = payment?.payment_method === 'stripe' ? Number(payment.amount) : fees + prepaid
  const settled = !!order.shopping_hold_settled_at && order.actual_items_total != null
  const actual = settled ? Number(order.actual_items_total) : null
  const unused = actual == null ? null : Math.max(0, Math.round((prepaid - actual) * 100) / 100)
  const refunds = payment?.refund_jobs ?? []
  const returned = payment?.refund_jobs !== undefined ? refunds.filter(r=>r.state==='succeeded').reduce((sum,r)=>sum+Number(r.amount),0) : order.payment_method !== 'stripe' && settled ? unused ?? 0 : 0
  return { fees, prepaid, charged, actual, unused, returned, retained: Math.max(0, Math.round((charged-returned)*100)/100), refunds }
}
