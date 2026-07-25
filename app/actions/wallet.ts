"use server"

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

  const admin = createAdminClient()

  // Fetch the delivery
  const { data: delivery, error: fetchErr } = await admin
    .from("delivery_requests")
    .select("id, status, customer_id, price, pickup_lat, pickup_lng, delivery_lat, delivery_lng, tracking_number")
    .eq("id", deliveryId)
    .single()

  if (fetchErr || !delivery) return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: "Order not found" }
  if ((delivery as any).customer_id !== user.id) return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: "Not your order" }

  const status = (delivery as any).status as string
  if (status === "delivered" || status === "cancelled") {
    return { success: false, freeCancel: false, cancellationFee: 0, distanceMiles: 0, refundAmount: 0, error: "This order cannot be cancelled" }
  }

  const freeStatuses = ["requested", "accepted"]
  const freeCancel = freeStatuses.includes(status)

  let cancellationFee = 0
  let distanceMiles = 0
  let refundAmount = 0

  if (freeCancel) {
    // The delivery price was deducted from the wallet at order creation —
    // "free cancellation" must mean the customer gets that back, not that
    // the prepayment silently vanishes. Only refund if this order was
    // actually wallet-funded (has a matching deduction transaction);
    // legacy orders created before wallet-funding was required have none.
    const { data: deductionTx } = await admin
      .from("wallet_transactions")
      .select("amount")
      .eq("delivery_id", deliveryId)
      .eq("type", "deduction")
      .limit(1)
      .maybeSingle()

    if (deductionTx?.amount) {
      refundAmount = Math.abs(Number(deductionTx.amount))
      await admin.rpc("increment_wallet_balance", { p_user_id: user.id, p_amount: refundAmount })
      await admin.from("wallet_transactions").insert({
        user_id: user.id,
        type: "cashback",
        amount: refundAmount,
        description: `Refund for cancelled order ${(delivery as any).tracking_number ?? deliveryId.slice(0, 8).toUpperCase()}`,
        delivery_id: deliveryId,
      })
    }
  }

  if (!freeCancel) {
    // Calculate distance
    const d = delivery as any
    if (d.pickup_lat && d.pickup_lng && d.delivery_lat && d.delivery_lng) {
      distanceMiles = haversineMiles(
        Number(d.pickup_lat), Number(d.pickup_lng),
        Number(d.delivery_lat), Number(d.delivery_lng)
      )
      cancellationFee = Math.ceil(distanceMiles) // £1 per mile, rounded up
    } else {
      cancellationFee = 5 // fallback minimum fee if no coordinates
      distanceMiles = 0
    }

    // Deduct from wallet
    const { data: wallet } = await admin.from("wallet_balances").select("balance").eq("user_id", user.id).single()
    const currentBalance = wallet ? Number(wallet.balance) : 0
    const newBalance = currentBalance - cancellationFee

    await admin.from("wallet_balances").upsert(
      { user_id: user.id, balance: newBalance, updated_at: new Date().toISOString() },
      { onConflict: "user_id" }
    )

    // Log fee transaction
    await admin.from("wallet_transactions").insert({
      user_id: user.id,
      type: "cancellation_fee",
      amount: -cancellationFee,
      description: `Cancellation fee for order ${(delivery as any).tracking_number ?? deliveryId.slice(0, 8).toUpperCase()} (${distanceMiles.toFixed(1)} miles × £1)`,
      delivery_id: deliveryId,
    })
  }

  // Cancel the order
  await admin
    .from("delivery_requests")
    .update({ status: "cancelled", cancelled_by: "customer" })
    .eq("id", deliveryId)

  // Notify customer
  await admin.from("notifications").insert({
    user_id: user.id,
    title: freeCancel ? "Order Cancelled" : "Order Cancelled — Fee Applied",
    body: freeCancel
      ? refundAmount > 0
        ? `Your order has been cancelled and £${refundAmount.toFixed(2)} was refunded to your wallet.`
        : "Your order has been cancelled at no charge."
      : `Your order was cancelled. A £${cancellationFee} cancellation fee was deducted from your wallet.`,
  })

  return { success: true, freeCancel, cancellationFee, distanceMiles, refundAmount }
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
    .select("id, status, customer_id, pickup_lat, pickup_lng, delivery_lat, delivery_lng")
    .eq("id", deliveryId)
    .single()

  if (!delivery || (delivery as any).customer_id !== user.id) {
    return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status: "", canCancel: false, error: "Not found" }
  }

  const status = (delivery as any).status as string
  if (status === "delivered" || status === "cancelled") {
    return { freeCancel: false, cancellationFee: 0, distanceMiles: 0, status, canCancel: false }
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
