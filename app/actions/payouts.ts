"use server"

import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath }    from "next/cache"

/**
 * Driver calls this to request a payout of all their pending earnings.
 *
 * Handles two cases:
 * 1. driver_earnings rows already exist (status='pending') — normal path.
 * 2. No driver_earnings rows yet, but completed delivery_requests exist
 *    (historical deliveries before auto-earnings was added) — we create the
 *    driver_earnings rows on the fly, then treat them as the payout amount.
 *
 * Either way: creates a payouts record (status='pending') and marks all
 * relevant driver_earnings rows as 'paid'.
 */
export async function requestDriverPayout() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  // ── 1. Get existing pending driver_earnings ──────────────────────────────
  const { data: pendingEarnings, error: earnErr } = await supabase
    .from("driver_earnings")
    .select("id, amount, delivery_id")
    .eq("driver_id", user.id)
    .eq("status", "pending")

  if (earnErr) return { error: earnErr.message }

  // ── 2. Find completed deliveries with no driver_earnings row yet ──────────
  //    (synthetic earnings — jobs done before the auto-earnings feature)
  const allEarningsDeliveryIds: string[] = []
  if (pendingEarnings && pendingEarnings.length > 0) {
    pendingEarnings.forEach(e => { if (e.delivery_id) allEarningsDeliveryIds.push(e.delivery_id) })
  }

  // Also fetch ALL driver_earnings for this driver (paid + pending) to avoid re-creating already-processed rows
  const { data: allDriverEarnings } = await supabase
    .from("driver_earnings")
    .select("delivery_id")
    .eq("driver_id", user.id)

  const coveredDeliveryIds = new Set(
    (allDriverEarnings ?? []).map(e => e.delivery_id).filter(Boolean),
  )

  // Completed deliveries not yet tracked in driver_earnings
  const { data: unclaimedDeliveries } = await supabase
    .from("delivery_requests")
    .select("id, price")
    .eq("driver_id", user.id)
    .eq("status", "delivered")
    .not("price", "is", null)

  const unclaimed = (unclaimedDeliveries ?? []).filter(d => !coveredDeliveryIds.has(d.id))

  // ── 3. Calculate payout total ─────────────────────────────────────────────
  const realPendingAmount   = (pendingEarnings ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const syntheticAmount     = unclaimed.reduce(
    (s, d) => s + Math.round((d.price ?? 0) * 0.75 * 100) / 100,
    0,
  )
  const total = Math.round((realPendingAmount + syntheticAmount) * 100) / 100

  if (total <= 0) return { error: "No pending earnings to withdraw" }

  // ── 4. Create driver_earnings rows for unclaimed deliveries ───────────────
  if (unclaimed.length > 0) {
    await admin.from("driver_earnings").upsert(
      unclaimed.map(d => ({
        driver_id:         user.id,
        delivery_id:       d.id,
        amount:            Math.round((d.price ?? 0) * 0.75 * 100) / 100,
        commission_amount: Math.round((d.price ?? 0) * 0.25 * 100) / 100,
        status:            "pending",
      })),
      { onConflict: "delivery_id" },
    )
  }

  // ── 5. Create payout record (admin client to bypass RLS on payouts) ───────
  const { error: payoutErr } = await admin.from("payouts").insert({
    driver_id: user.id,
    amount:    total,
    status:    "pending",
  })
  if (payoutErr) return { error: payoutErr.message }

  // ── 6. Mark all pending driver_earnings as paid ───────────────────────────
  const { data: nowPending } = await admin
    .from("driver_earnings")
    .select("id")
    .eq("driver_id", user.id)
    .eq("status", "pending")

  const idsToMark = (nowPending ?? []).map(e => e.id)
  if (idsToMark.length > 0) {
    await admin.from("driver_earnings").update({ status: "paid" }).in("id", idsToMark)
  }

  revalidatePath("/dashboard/driver/payouts")
  revalidatePath("/dashboard/driver/earnings")
  revalidatePath("/dashboard/admin/payouts")
  return { success: true, amount: total }
}

/**
 * Admin marks a payout record as 'paid' (processed/disbursed).
 */
export async function markPayoutPaid(payoutId: string) {
  const admin = createAdminClient()
  const { error } = await admin
    .from("payouts")
    .update({ status: "paid" })
    .eq("id", payoutId)
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/payouts")
  return { success: true }
}

/**
 * Admin processes all pending payout requests at once.
 */
export async function markAllPayoutsPaid() {
  const admin = createAdminClient()
  const { error } = await admin
    .from("payouts")
    .update({ status: "paid" })
    .eq("status", "pending")
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/payouts")
  return { success: true }
}

/**
 * Admin processes a specific driver's pending earnings directly:
 * creates a 'paid' payout record and marks all their driver_earnings as 'paid'.
 * Also creates driver_earnings rows for any unclaimed completed deliveries.
 */
export async function adminProcessDriverPayout(driverId: string) {
  const admin = createAdminClient()

  // Existing pending driver_earnings
  const { data: pending, error: fetchErr } = await admin
    .from("driver_earnings")
    .select("id, amount, delivery_id")
    .eq("driver_id", driverId)
    .eq("status", "pending")

  if (fetchErr) return { error: fetchErr.message }

  // Unclaimed completed deliveries
  const { data: allEarnings } = await admin
    .from("driver_earnings")
    .select("delivery_id")
    .eq("driver_id", driverId)

  const covered = new Set((allEarnings ?? []).map(e => e.delivery_id).filter(Boolean))

  const { data: unclaimedDeliveries } = await admin
    .from("delivery_requests")
    .select("id, price")
    .eq("driver_id", driverId)
    .eq("status", "delivered")
    .not("price", "is", null)

  const unclaimed = (unclaimedDeliveries ?? []).filter(d => !covered.has(d.id))

  const realAmount      = (pending ?? []).reduce((s, e) => s + (e.amount ?? 0), 0)
  const syntheticAmount = unclaimed.reduce((s, d) => s + Math.round((d.price ?? 0) * 0.75 * 100) / 100, 0)
  const total           = Math.round((realAmount + syntheticAmount) * 100) / 100

  if (total <= 0) return { error: "No pending earnings for this driver" }

  // Create earnings rows for unclaimed deliveries
  if (unclaimed.length > 0) {
    await admin.from("driver_earnings").upsert(
      unclaimed.map(d => ({
        driver_id:         driverId,
        delivery_id:       d.id,
        amount:            Math.round((d.price ?? 0) * 0.75 * 100) / 100,
        commission_amount: Math.round((d.price ?? 0) * 0.25 * 100) / 100,
        status:            "pending",
      })),
      { onConflict: "delivery_id" },
    )
  }

  // Create a 'paid' payout record (admin directly approves)
  const { error: payoutErr } = await admin.from("payouts").insert({
    driver_id: driverId,
    amount:    total,
    status:    "paid",
  })
  if (payoutErr) return { error: payoutErr.message }

  // Mark all pending earnings as paid
  const { data: nowPending } = await admin
    .from("driver_earnings")
    .select("id")
    .eq("driver_id", driverId)
    .eq("status", "pending")

  const ids = (nowPending ?? []).map(e => e.id)
  if (ids.length > 0) {
    await admin.from("driver_earnings").update({ status: "paid" }).in("id", ids)
  }

  revalidatePath("/dashboard/admin/payouts")
  return { success: true, amount: total }
}
