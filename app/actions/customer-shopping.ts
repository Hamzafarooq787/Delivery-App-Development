'use server'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import type { ShoppingItemRow } from '@/app/actions/shopping'
import type { RefundRecord } from '@/lib/shopping-summary'
export type CustomerShoppingOrder = {
  id: string; status: string; bfm_stage: string | null; shop_name: string | null; service_type: string
  price: number; max_spend_approved: number; estimated_items_total: number | null; actual_items_total: number | null
  receipt_url: string | null; shopping_hold_settled_at: string | null; payment_method: string | null
}
export type ShoppingDecision = { id: string; shopping_item_id: string; suggested_name: string; suggested_price: number; driver_notes: string | null; photo_url: string | null; customer_approved: boolean | null; customer_responded_at: string | null }
export type CustomerShoppingDetails = { order: CustomerShoppingOrder; items: ShoppingItemRow[]; decisions: ShoppingDecision[]; payment: { amount: number; payment_method: string; refund_jobs: RefundRecord[] } | null }
export async function getCustomerShoppingDetails(orderId: string): Promise<{ data: CustomerShoppingDetails } | { error: string }> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user) return { error: 'Please sign in to view this shopping order.' }
  const db = createAdminClient()
  const { data: order, error } = await db.from('delivery_requests')
    .select('id,status,bfm_stage,shop_name,service_type,price,max_spend_approved,estimated_items_total,actual_items_total,receipt_url,shopping_hold_settled_at,payment_method')
    .eq('id',orderId).eq('customer_id',user.id).eq('service_type','buy_for_me').maybeSingle()
  if (error || !order) return { error: 'Shopping order is unavailable.' }
  const [items, decisions, payment] = await Promise.all([
    db.from('shopping_items').select('id,delivery_id,name,quantity,estimated_price,actual_price,brand_size_variant,notes,photo_url,substitution_preference,status,created_at,confirmed_unit_price').eq('delivery_id',orderId).order('created_at'),
    db.from('shopping_substitutions').select('id,shopping_item_id,suggested_name,suggested_price,driver_notes,photo_url,customer_approved,customer_responded_at').eq('delivery_id',orderId).order('created_at'),
    db.from('payments').select('amount,payment_method,refund_jobs').eq('delivery_id',orderId).maybeSingle(),
  ])
  if (items.error || decisions.error || payment.error) return { error: 'Shopping details could not load. Please retry.' }
  return { data: { order, items: items.data as ShoppingItemRow[], decisions: decisions.data as ShoppingDecision[], payment: payment.data } }
}
