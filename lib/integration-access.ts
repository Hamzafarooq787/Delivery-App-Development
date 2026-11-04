import "server-only"
import { boundedFetch } from "@/lib/short-request"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
export async function integrationIdentity() {
  const session = await createClient(boundedFetch(6000))
  const {data,error} = await session.auth.getClaims()
  if (error && (error.name==="AuthRetryableFetchError" || (error.status??0)>=500 || error.status===429)) return {error:"Sign-in service is temporarily unavailable. Please retry.",status:503} as const
  const userId=data?.claims.sub
  if (error || !userId) return {error:"Please sign in again.",status:401} as const
  const profile = await createAdminClient(boundedFetch(5000)).from("users").select("account_status").eq("id",userId).maybeSingle()
  if (profile.error) return {error:"Service unavailable. Please retry.",status:503} as const
  if (profile.data?.account_status !== "active") return {error:"Account unavailable. Please contact support.",status:403} as const
  return {userId:userId} as const
}
export async function integrationBudget(userId:string,service:"maps"|"chat") {
  const {data,error} = await createAdminClient(boundedFetch(5000)).rpc("claim_integration_request",{p_user:userId,p_service:service})
  return error ? {error:"Service unavailable. Please retry.",status:503} as const : !data ? {error:"Please wait before trying again.",status:429} as const : null
}
