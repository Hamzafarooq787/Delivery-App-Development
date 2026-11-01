import "server-only"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
export async function integrationIdentity() {
  const session = await createClient()
  const {data:{user},error} = await session.auth.getUser()
  if (error || !user) return {error:"Please sign in again.",status:401} as const
  const profile = await createAdminClient().from("users").select("account_status").eq("id",user.id).maybeSingle()
  if (profile.error) return {error:"Service unavailable. Please retry.",status:503} as const
  if (profile.data?.account_status !== "active") return {error:"Account unavailable. Please contact support.",status:403} as const
  return {userId:user.id} as const
}
export async function integrationBudget(userId:string,service:"maps"|"chat") {
  const {data,error} = await createAdminClient().rpc("claim_integration_request",{p_user:userId,p_service:service})
  return error ? {error:"Service unavailable. Please retry.",status:503} as const : !data ? {error:"Please wait before trying again.",status:429} as const : null
}
