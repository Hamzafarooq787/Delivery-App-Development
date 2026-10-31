/**
 * lib/marketing/segments.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Shared customer-segment resolution for marketing campaigns and the
 * automatic re-engagement cron. "Inactive" activity is derived from
 * delivery_requests — there is no dedicated last-active tracking table.
 *
 * ⚠️  SERVER-SIDE ONLY.
 */

import {allAuthUsers} from "@/lib/auth-directory"
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

  const {data,error}=await admin.rpc('marketing_customer_activity',{p_ids:customerIds})
  if(error)throw new Error('Customer activity could not load. Please retry.')
  return data??{}

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
  const customers: {id:string;full_name:string|null;created_at:string;marketing_email_opt_in:boolean;marketing_push_opt_in:boolean}[]=[]
  for(let page=0;;page++){
    const {data,error}=await admin.from("admin_customer_accounts").select("id, full_name, marketing_email_opt_in, marketing_push_opt_in, created_at").eq("account_status","active").order('id').range(page*1000,page*1000+999)
    if(error)throw new Error("Customer audience could not load. Please retry.")
    customers.push(...(data??[]));if(!data||data.length<1000)break
  }
  if (!customers || customers.length === 0) return []

  const customerIds = customers.map((c) => c.id)
  const [authRes, activityMap] = await Promise.all([
    allAuthUsers(admin),
    getLastActivityMap(admin, customerIds),
  ])
  if (authRes.error) throw new Error("Customer contact details could not load. Please retry.")
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
