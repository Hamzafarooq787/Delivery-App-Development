"use server"

import { cancelCardBooking } from "@/app/actions/order-checkout"
import { processOrderRefunds } from "@/lib/payments/direct"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

export type WalletTransaction = {
  id: string
  type: "topup" | "cashback" | "cancellation_fee" | "deduction"
  amount: number
  description: string | null
  delivery_id: string | null
  created_at: string
}

// ── Haversine distance in miles ───────────────────────────────────────────
function haversineMiles(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 3958.8 // Earth radius in miles
  const dLat = ((lat2 - lat1) * Math.PI) / 180
  const dLon = ((lon2 - lon1) * Math.PI) / 180
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// ── Get wallet balance ────────────────────────────────────────────────────
export async function getWalletBalance(): Promise<{ balance: number; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { balance: 0, error: "Not authenticated" }

  const admin = createAdminClient()
  const { data } = await admin.from("wallet_balances").select("balance").eq("user_id", user.id).single()
  return { balance: data ? Number(data.balance) : 0 }
}

// ── Get wallet transactions ───────────────────────────────────────────────
export async function getWalletTransactions(): Promise<{ data: WalletTransaction[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const admin = createAdminClient()
  const { data } = await admin
    .from("wallet_transactions")
    .select("id, type, amount, description, delivery_id, created_at")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })
    .limit(50)

  return { data: (data ?? []) as WalletTransaction[] }
}

// ── Cancel order (customer) ───────────────────────────────────────────────
export type CancelOrderResult = {
  success: boolean
  freeCancel: boolean
  cancellationFee: number
  distanceMiles: number
  refundAmount: number
  error?: string
}

export async function cancelOrder(deliveryId: string): Promise<CancelOrderResult> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: "Not authenticated" }

  const { data: cardOrder } = await createAdminClient().from("delivery_requests").select("payment_method").eq("id",deliveryId).eq("customer_id",user.id).maybeSingle()
  if (cardOrder?.payment_method === "stripe") {
    const result = await cancelCardBooking(deliveryId)
    return { success: !result.error, freeCancel: true, cancellationFee: 0, distanceMiles: 0, refundAmount: result.amount ?? 0, error: result.error }
  }
  // Atomic RPC — locks the delivery row before doing anything, so concurrent
  // cancel calls on the same order can't both read "still cancellable" and
  // both credit a refund. See scripts/030_security_hardening.sql.
  const { data, error } = await supabase.rpc("cancel_delivery_order", { p_delivery_id: deliveryId })

  if (error) {
    const msg = error.message ?? ""
    let friendly = "Could not cancel this order. Please try again."
    if (msg.includes("not_found")) friendly = "Order not found"
    else if (msg.includes("not_your_order")) friendly = "Not your order"
    else if (msg.includes("cannot_cancel")) friendly = "This order cannot be cancelled"
    return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: friendly }
  }

  return {
    success: true,
    freeCancel: data.freeCancel,
    cancellationFee: Number(data.cancellationFee),
    distanceMiles: Number(data.distanceMiles),
    refundAmount: Number(data.refundAmount),
  }
}

// ── Preview cancellation fee (before confirming) ──────────────────────────
export async function previewCancellationFee(deliveryId: string): Promise<{
  freeCancel: boolean
  cancellationFee: number
  distanceMiles: number
  status: string
  canCancel: boolean
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status: "", canCancel: false, error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: delivery } = await admin
    .from("delivery_requests")
    .select("id, status, customer_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng, payment_method, bfm_stage")
    .eq("id", deliveryId)
    .single()

  if (!delivery || (delivery as any).customer_id !== user.id) {
    return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status: "", canCancel: false, error: "Not found" }
  }

  const status = (delivery as any).status as string
  if (status === "delivered" || status === "cancelled") {
    return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status, canCancel: false }
  }

  if (delivery.payment_method === 'stripe') {
    const allowed=['requested','accepted'].includes(status)&&!['shopping','purchase_completed','heading_to_customer'].includes(delivery.bfm_stage)
    return { freeCancel: allowed, cancellationFee: 0, distanceMiles: 0, status, canCancel: allowed, ...(!allowed ? { error: 'Contact support to cancel after collection or shopping starts.' } : {}) }
  }
  const freeCancel = ["requested", "accepted"].includes(status)
  let cancellationFee = 0
  let distanceMiles = 0

  if (!freeCancel) {
    const d = delivery as any
    if (d.pickup_lat && d.pickup_lng && d.delivery_lat && d.delivery_lng) {
      distanceMiles = haversineMiles(Number(d.pickup_lat), Number(d.pickup_lng), Number(d.delivery_lat), Number(d.delivery_lng))
      cancellationFee = Math.ceil(distanceMiles)
    } else {
      cancellationFee = 5
    }
  }

  return { freeCancel, cancellationFee, distanceMiles, status, canCancel: true }
}

// ── Admin: cancel an order and optionally refund the customer ─────────────
export async function adminCancelOrder(deliveryId: string): Promise<{
  success?: boolean
  refunded?: boolean
  refundAmount?: number
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: adminRow } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  if (adminRow?.role !== "admin") return { error: "Not authorized" }

  const admin = createAdminClient()

  const { data: cardOrder } = await admin.from("delivery_requests").select("payment_method").eq("id",deliveryId).maybeSingle()
  if (cardOrder?.payment_method === "stripe") {
    const result = await cancelCardBooking(deliveryId)
    return result.error ? { error: result.error } : { success: true, refunded: false, refundAmount: result.amount }
  }
  const { data: delivery, error: fetchErr } = await admin
    .from("delivery_requests")
    .select("id, status, customer_id, price")
    .eq("id", deliveryId)
    .single()

  if (fetchErr || !delivery) return { error: "Order not found" }
  if (["delivered", "cancelled"].includes(delivery.status))
    return { error: "This order cannot be cancelled" }

  const { error: cancelErr } = await admin
    .from("delivery_requests")
    .update({ status: "cancelled", driver_id: null })
    .eq("id", deliveryId)

  if (cancelErr) return { error: cancelErr.message }

  // Refund full price to customer wallet if there's a price and a customer
  let refunded = false
  const refundAmount = Number(delivery.price ?? 0)
  if (refundAmount > 0 && delivery.customer_id) {
    const { data: wallet } = await admin
      .from("wallet_balances")
      .select("balance")
      .eq("user_id", delivery.customer_id)
      .maybeSingle()

    const currentBalance = Number(wallet?.balance ?? 0)
    await admin
      .from("wallet_balances")
      .upsert({ user_id: delivery.customer_id, balance: currentBalance + refundAmount }, { onConflict: "user_id" })

    await admin.from("wallet_transactions").insert({
      user_id:     delivery.customer_id,
      type:        "cashback",
      amount:      refundAmount,
      description: "Admin cancellation refund",
      delivery_id: deliveryId,
    })
    refunded = true
  }

  const { revalidatePath } = await import("next/cache")
  revalidatePath("/dashboard/admin/orders")
  revalidatePath(`/dashboard/admin/orders/${deliveryId}`)
  return { success: true, refunded, refundAmount }
}

// ── Admin: issue a manual refund to the customer's wallet ─────────────────
export async function adminIssueRefund(deliveryId: string, amount: number): Promise<{
  success?: boolean
  error?: string
}> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }
  const { data: adminRow } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  if (adminRow?.role !== "admin") return { error: "Not authorized" }

  if (!amount || amount <= 0) return { error: "Invalid refund amount" }

  const admin = createAdminClient()

  const { data: delivery, error: fetchErr } = await admin
    .from("delivery_requests")
    .select("id, customer_id")
    .eq("id", deliveryId)
    .single()

  if (fetchErr || !delivery || !delivery.customer_id) return { error: "Order not found" }

  const { data: cardPayment } = await admin.from("payments").select("id").eq("delivery_id", deliveryId).eq("payment_method", "stripe").maybeSingle()
  if (cardPayment) return { error: "Card refunds must use the original-payment refund workflow; wallet refunds are not allowed." }
  const { data: wallet } = await admin
    .from("wallet_balances")
    .select("balance")
    .eq("user_id", delivery.customer_id)
    .maybeSingle()

  const currentBalance = Number(wallet?.balance ?? 0)
  await admin
    .from("wallet_balances")
    .upsert({ user_id: delivery.customer_id, balance: currentBalance + amount }, { onConflict: "user_id" })

  await admin.from("wallet_transactions").insert({
    user_id:     delivery.customer_id,
    type:        "cashback",
    amount,
    description: "Admin manual refund",
    delivery_id: deliveryId,
  })

  const { revalidatePath } = await import("next/cache")
  revalidatePath(`/dashboard/admin/orders/${deliveryId}`)
  return { success: true }
}
