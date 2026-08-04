/**
 * lib/marketing/segments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared customer-segment resolution for marketing campaigns and the
 * automatic re-engagement cron. "Inactive" activity is derived from
 * delivery_requests — there is no dedicated last-active tracking table.
 *
 * ⚠️  SERVER-SIDE ONLY.
 */

import type { SupabaseClient } from "@supabase/supabase-js"

export type MarketingSegment = "all" | "inactive"

export type MarketingRecipient = {
  id: string
  full_name: string
  email: string | null
  marketing_email_opt_in: boolean
  marketing_push_opt_in: boolean
  last_activity_at: string
}

/** Last order date (or signup date if the customer has never ordered) per user id. */
export async function getLastActivityMap(
  admin: SupabaseClient,
  customerIds: string[]
): Promise<Record<string, string>> {
  if (customerIds.length === 0) return {}

  const [usersRes, ordersRes] = await Promise.all([
    admin.from("users").select("id, created_at").in("id", customerIds),
    admin
      .from("delivery_requests")
      .select("customer_id, created_at")
      .in("customer_id", customerIds)
      .order("created_at", { ascending: false }),
  ])

  const activity: Record<string, string> = {}
  for (const u of usersRes.data ?? []) {
    activity[u.id] = u.created_at
  }
  // Orders are sorted newest-first, so the first row seen per customer is their latest.
  for (const o of ordersRes.data ?? []) {
    if (!o.customer_id) continue
    if (!activity[o.customer_id] || new Date(o.created_at) > new Date(activity[o.customer_id])) {
      activity[o.customer_id] = o.created_at
    }
  }
  return activity
}

/**
 * Resolve which customers belong to a marketing segment, with their
 * marketing consent flags and email attached.
 */
export async function resolveMarketingRecipients(
  admin: SupabaseClient,
  segment: MarketingSegment,
  inactiveDays?: number | null
): Promise<MarketingRecipient[]> {
  const { data: customers } = await admin
    .from("users")
    .select("id, full_name, marketing_email_opt_in, marketing_push_opt_in, created_at")
    .eq("role", "customer")

  if (!customers || customers.length === 0) return []

  const customerIds = customers.map((c) => c.id)
  const [authRes, activityMap] = await Promise.all([
    admin.auth.admin.listUsers({ perPage: 1000 }),
    getLastActivityMap(admin, customerIds),
  ])
  const emailMap = new Map((authRes.data?.users ?? []).map((u: { id: string; email?: string }) => [u.id, u.email ?? null]))

  let filtered = customers
  if (segment === "inactive" && inactiveDays) {
    const cutoff = Date.now() - inactiveDays * 24 * 60 * 60 * 1000
    filtered = customers.filter((c) => {
      const lastActivity = activityMap[c.id] ?? c.created_at
      return new Date(lastActivity).getTime() < cutoff
    })
  }

  return filtered.map((c) => ({
    id: c.id,
    full_name: c.full_name ?? "",
    email: emailMap.get(c.id) ?? null,
    marketing_email_opt_in: c.marketing_email_opt_in,
    marketing_push_opt_in: c.marketing_push_opt_in,
    last_activity_at: activityMap[c.id] ?? c.created_at,
  }))
}
