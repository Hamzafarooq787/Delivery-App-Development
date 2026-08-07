/**
 * app/actions/ratings.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ratings & Reviews — customers and drivers rate each other after every
 * completed delivery. The `ratings` table has no client-facing insert
 * policy (see scripts/029_ratings.sql) — submitRating() is the only
 * legitimate write path, and it validates eligibility server-side before
 * writing via the admin client.
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type Rating = {
  id: string
  delivery_id: string
  rater_id: string
  rated_id: string
  rater_role: "customer" | "driver"
  score: number
  comment: string | null
  created_at: string
}

export async function submitRating(input: {
  deliveryId: string
  score: number
  comment?: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (!Number.isInteger(input.score) || input.score < 1 || input.score > 5) {
    return { error: "Rating must be between 1 and 5 stars." }
  }

  const admin = createAdminClient()

  const { data: delivery, error: deliveryError } = await admin
    .from("delivery_requests")
    .select("id, status, customer_id, driver_id")
    .eq("id", input.deliveryId)
    .single()

  if (deliveryError || !delivery) return { error: "Delivery not found" }
  if (delivery.status !== "delivered") return { error: "This delivery hasn't been completed yet." }

  let raterRole: "customer" | "driver"
  let ratedId: string

  if (delivery.customer_id === user.id) {
    if (!delivery.driver_id) return { error: "No driver was assigned to this delivery." }
    raterRole = "customer"
    ratedId = delivery.driver_id
  } else if (delivery.driver_id === user.id) {
    if (!delivery.customer_id) return { error: "No customer found for this delivery." }
    raterRole = "driver"
    ratedId = delivery.customer_id
  } else {
    return { error: "You weren't part of this delivery." }
  }

  const { error } = await admin.from("ratings").insert({
    delivery_id: input.deliveryId,
    rater_id: user.id,
    rated_id: ratedId,
    rater_role: raterRole,
    score: input.score,
    comment: input.comment?.trim() || null,
  })

  if (error) {
    return { error: error.code === "23505" ? "You've already rated this delivery." : error.message }
  }

  revalidatePath("/dashboard/customer/tracking")
  revalidatePath(`/dashboard/driver/jobs/${input.deliveryId}`)
  revalidatePath(`/dashboard/admin/orders/${input.deliveryId}`)
  return { success: true }
}

/** Has the current user already rated this delivery? RLS-scoped to their own rating. */
export async function getMyRatingForDelivery(deliveryId: string): Promise<{ data: Rating | null }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null }

  const { data } = await supabase
    .from("ratings")
    .select("*")
    .eq("delivery_id", deliveryId)
    .eq("rater_id", user.id)
    .maybeSingle()

  return { data: data as Rating | null }
}

/**
 * Public aggregate for a user (driver or customer) — safe to expose to
 * anyone, since it's just a number and a count, never the underlying
 * comments. Used to show a real star rating instead of a placeholder.
 */
export async function getRatingSummary(userId: string): Promise<{ average: number | null; count: number }> {
  const admin = createAdminClient()
  const { data } = await admin.from("ratings").select("score").eq("rated_id", userId)
  if (!data || data.length === 0) return { average: null, count: 0 }
  const sum = data.reduce((acc, r) => acc + r.score, 0)
  return { average: Math.round((sum / data.length) * 100) / 100, count: data.length }
}

/** Both ratings (if any) for a delivery — RLS lets admins see either direction. */
export async function getDeliveryRatings(deliveryId: string): Promise<{ data: Rating[] }> {
  const supabase = await createClient()
  const { data } = await supabase.from("ratings").select("*").eq("delivery_id", deliveryId)
  return { data: (data ?? []) as Rating[] }
}
