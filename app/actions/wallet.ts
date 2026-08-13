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
