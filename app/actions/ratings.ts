/**
 * app/actions/ratings.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Ratings & Reviews — customers and drivers rate each other after every
 * completed delivery. The `ratings` table has no client-facing insert
 * policy (see scripts/029_ratings.sql) — submitRating() is the only
 * legitimate write path, and it validates eligibility server-side before
 * writing via the admin client.
 *
 * Moderation: a rating starts 'pending' and is only visible to the person
 * it's about once an admin approves it (adminApproveRating /
 * adminRejectRating below). The person who wrote it can always see their
 * own submission regardless of status.
 */
"use server"

import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type RatingStatus = "pending" | "approved" | "rejected"

export type Rating = {
  id: string
  delivery_id: string
  rater_id: string
  rated_id: string
  rater_role: "customer" | "driver"
  score: number
  comment: string | null
  status: RatingStatus
  moderated_at: string | null
  created_at: string
}

export type PendingRating = Rating & {
  delivery: { tracking_number: string | null } | null
  rater: { full_name: string | null } | null
  rated: { full_name: string | null } | null
}

export async function submitRating(input: {
  deliveryId: string
  score: number
  comment?: string
}): Promise<{ success?: boolean; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  if (!input || !Number.isInteger(input.score) || input.score < 1 || input.score > 5 || typeof input.deliveryId !== "string" || !/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(input.deliveryId) || input.comment !== undefined && (typeof input.comment !== "string" || input.comment.length > 2000)) return {error:"Choose 1–5 stars and a comment of up to 2,000 characters."}
  const {error} = await createAdminClient().rpc("submit_delivery_rating",{p_actor:user.id,p_delivery:input.deliveryId,p_score:input.score,p_comment:input.comment?.trim() || null})
  if(error)return {error:error.code === "23505" ? "You've already rated this delivery." : "This completed delivery cannot be rated by your account. Please refresh or contact support."}

  revalidatePath("/dashboard/customer/tracking")
  revalidatePath(`/dashboard/driver/jobs/${input.deliveryId}`)
  revalidatePath(`/dashboard/admin/orders/${input.deliveryId}`)
  revalidatePath("/dashboard/admin/reviews")
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
 * comments. Only counts APPROVED ratings — pending/rejected ones never
 * affect what other people see.
 */
export async function getRatingSummary(userId: string): Promise<{ average: number | null; count: number }> {
  if(typeof userId !== "string" || !/^[0-9a-f-]{36}$/i.test(userId))return {average:null,count:0}
  const {data,error}=await createAdminClient().rpc("approved_rating_summary",{p_user:userId})
  return error || !data ? {average:null,count:0} : {average:data.average,count:Number(data.count)}
}

/** Both ratings (if any) for a delivery — RLS lets admins see either direction, any status. */
export async function getDeliveryRatings(deliveryId: string): Promise<{ data: Rating[] }> {
  const supabase = await createClient()
  const { data } = await supabase.from("ratings").select("*").eq("delivery_id", deliveryId)
  return { data: (data ?? []) as Rating[] }
}

// ── Admin moderation ─────────────────────────────────────────────────────────

async function requireAdmin(): Promise<boolean> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return false
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  return !!(await getAdminActor("support"))
}

export async function adminGetPendingReviewCount(): Promise<number> {
  if (!(await getAdminActor("support"))) return 0
  const admin = createAdminClient()
  const { count } = await admin.from("ratings").select("id", { count: "exact", head: true }).eq("status", "pending")
  return count ?? 0
}

export async function adminGetPendingRatings(): Promise<{ data: PendingRating[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("ratings")
    .select("*, delivery:delivery_requests(tracking_number), rater:users!ratings_rater_id_fkey(full_name), rated:users!ratings_rated_id_fkey(full_name)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as unknown as PendingRating[] }
}

export async function adminApproveRating(ratingId: string): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("support","adminApproveRating",ratingId,async()=>{
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await requireAdmin())) return { error: "Not authorized" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("ratings")
    .update({ status: "approved", moderated_at: new Date().toISOString(), moderated_by: user.id })
    .eq("id", ratingId)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/reviews")
  return { success: true }

 })
}

export async function adminRejectRating(ratingId: string): Promise<{ success?: boolean; error?: string }> {
 return runAdminMutation("support","adminRejectRating",ratingId,async()=>{
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !(await requireAdmin())) return { error: "Not authorized" }

  const admin = createAdminClient()
  const { error } = await admin
    .from("ratings")
    .update({ status: "rejected", moderated_at: new Date().toISOString(), moderated_by: user.id })
    .eq("id", ratingId)

  if (error) return { error: error.message }
  revalidatePath("/dashboard/admin/reviews")
  return { success: true }

 })
}
