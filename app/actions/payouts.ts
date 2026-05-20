"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

/**
 * Driver calls this to request a payout of all their pending earnings.
 * Creates a payouts record and marks driver_earnings as 'paid'.
 */
export async function requestDriverPayout() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  // Get all pending earnings
  const { data: pending, error: fetchErr } = await supabase
    .from("driver_earnings")
    .select("id, amount")
    .eq("driver_id", user.id)
    .eq("status", "pending")

  if (fetchErr) return { error: fetchErr.message }
  if (!pending || pending.length === 0) return { error: "No pending earnings to withdraw" }

  const total = pending.reduce((s, e) => s + (e.amount ?? 0), 0)
  if (total <= 0) return { error: "No balance available" }

  const admin = createAdminClient()

  // Create payout record
  const { error: payoutErr } = await admin.from("payouts").insert({
    driver_id: user.id,
    amount: total,
    status: "pending",
  })
  if (payoutErr) return { error: payoutErr.message }

  // Mark earnings as paid
  const ids = pending.map((e) => e.id)
  await admin.from("driver_earnings").update({ status: "paid" }).in("id", ids)

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
 * Admin processes a driver's pending earnings:
 * creates a 'paid' payout record and marks all their driver_earnings as 'paid'.
 */
export async function adminProcessDriverPayout(driverId: string) {
  const admin = createAdminClient()

  const { data: pending, error: fetchErr } = await admin
    .from("driver_earnings")
    .select("id, amount")
    .eq("driver_id", driverId)
    .eq("status", "pending")

  if (fetchErr) return { error: fetchErr.message }
  if (!pending || pending.length === 0) return { error: "No pending earnings for this driver" }

  const total = pending.reduce((s, e) => s + (e.amount ?? 0), 0)
  if (total <= 0) return { error: "No balance available" }

  const { error: payoutErr } = await admin.from("payouts").insert({
    driver_id: driverId,
    amount: total,
    status: "paid",
  })
  if (payoutErr) return { error: payoutErr.message }

  const ids = pending.map((e) => e.id)
  await admin.from("driver_earnings").update({ status: "paid" }).in("id", ids)

  revalidatePath("/dashboard/admin/payouts")
  return { success: true, amount: total }
}
