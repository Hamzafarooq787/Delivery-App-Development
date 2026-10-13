"use server"

import { createClient }      from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath }    from "next/cache"

/** Every admin-only function below uses the service-role client — this must gate all of them. */
async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  return data?.role === "admin"
}

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

  // ── 1. Find completed deliveries with no driver_earnings row yet ─────────
  //    (synthetic earnings — jobs done before the auto-earnings feature).
  //    Idempotent upsert (onConflict: delivery_id) — safe to run every time,
  //    including concurrently.
  const { data: allDriverEarnings } = await supabase
    .from("driver_earnings")
    .select("delivery_id")
    .eq("driver_id", user.id)

  const coveredDeliveryIds = new Set(
    (allDriverEarnings ?? []).map(e => e.delivery_id).filter(Boolean),
  )

  const { data: unclaimedDeliveries } = await supabase
    .from("delivery_requests")
    .select("id, price")
    .eq("driver_id", user.id)
    .eq("status", "delivered")
    .not("price", "is", null)

  const unclaimed = (unclaimedDeliveries ?? []).filter(d => !coveredDeliveryIds.has(d.id))

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

  // ── 2. Atomically claim every pending earning in one statement ───────────
  //    This UPDATE...RETURNING is the actual serialization point: if two
  //    requests race, Postgres's row-level locking means only the first to
  //    commit can match+claim each row — the second's WHERE clause finds
  //    nothing left to claim. The payout amount is computed from what was
  //    ACTUALLY claimed here, never from an earlier, now-stale read.
  const { data: claimed, error: claimErr } = await admin
    .from("driver_earnings")
    .update({ status: "paid" })
    .eq("driver_id", user.id)
    .eq("status", "pending")
    .select("id, amount")

  if (claimErr) return { error: claimErr.message }

  const total = Math.round((claimed ?? []).reduce((s, e) => s + (e.amount ?? 0), 0) * 100) / 100
  if (total <= 0) return { error: "No pending earnings to withdraw" }

  // ── 3. Create the payout record for exactly what was claimed ─────────────
  const { error: payoutErr } = await admin.from("payouts").insert({
    driver_id: user.id,
    amount:    total,
    status:    "pending",
  })
  if (payoutErr) return { error: payoutErr.message }

  revalidatePath("/dashboard/driver/payouts")
  revalidatePath("/dashboard/driver/earnings")
  revalidatePath("/dashboard/admin/payouts")
  return { success: true, amount: total }
}

/**
 * Admin marks a payout record as 'paid' (processed/disbursed).
 */
export async function markPayoutPaid(payoutId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized" }
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
  if (!(await requireAdmin())) return { error: "Not authorized" }
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
 * Admin approves a pending payout request (pending → approved).
 */
export async function approveDriverPayout(payoutId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { error } = await admin
    .from("payouts")
    .update({ status: "approved" })
    .eq("id", payoutId)
    .eq("status", "pending")
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/payouts")
  revalidatePath("/dashboard/driver/payouts")
  revalidatePath("/dashboard/driver")
  return { success: true }
}

/**
 * Admin rejects a pending or approved payout request.
 */
export async function rejectDriverPayout(payoutId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { data: payout, error: fetchErr } = await admin
    .from("payouts")
    .select("id, driver_id, status")
    .eq("id", payoutId)
    .single()
  if (fetchErr || !payout) return { error: "Payout not found" }
  if (!["pending", "approved"].includes(payout.status))
    return { error: "Only pending or approved payouts can be rejected" }

  const { error } = await admin
    .from("payouts")
    .update({ status: "rejected" })
    .eq("id", payoutId)
  if (error) return { error: error.message }

  revalidatePath("/dashboard/admin/payouts")
  revalidatePath("/dashboard/driver/payouts")
  revalidatePath("/dashboard/driver")
  return { success: true }
}

/**
 * Admin marks an approved payout as completed / paid (approved → paid).
 * Also accepts pending → paid for backwards-compat with the old single-step flow.
 */
export async function completeDriverPayout(payoutId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  const admin = createAdminClient()
  const { error } = await admin
    .from("payouts")
    .update({ status: "paid" })
    .eq("id", payoutId)
    .in("status", ["pending", "approved"])
  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/payouts")
  revalidatePath("/dashboard/driver/payouts")
  revalidatePath("/dashboard/driver")
  return { success: true }
}

/**
 * Fetch driver earnings + delivery breakdown for the detail modal.
 * Called lazily when an admin opens a payout detail view.
 */
export async function getDriverPayoutDetails(driverId: string) {
  if (!(await requireAdmin())) return { earnings: [], deliveries: [], payoutHistory: [], error: "Not authorized" }
  const admin = createAdminClient()
  const [earningsRes, deliveriesRes, payoutsHistoryRes] = await Promise.all([
    admin
      .from("driver_earnings")
      .select("id, amount, commission_amount, status, created_at")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(15),
    admin
      .from("delivery_requests")
      .select("id, tracking_number, price, status, created_at, pickup_address, delivery_address")
      .eq("driver_id", driverId)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("payouts")
      .select("id, amount, status, created_at")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(6),
  ])
  return {
    earnings:       earningsRes.data       ?? [],
    deliveries:     deliveriesRes.data     ?? [],
    payoutHistory:  payoutsHistoryRes.data ?? [],
  }
}

/**
 * Admin processes a specific driver's pending earnings directly:
 * creates a 'paid' payout record and marks all their driver_earnings as 'paid'.
 * Also creates driver_earnings rows for any unclaimed completed deliveries.
 */
export async function adminProcessDriverPayout(driverId: string) {
  if (!(await requireAdmin())) return { error: "Not authorized" }
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
