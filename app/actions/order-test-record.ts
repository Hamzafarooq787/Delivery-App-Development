"use server"
import { auditAdmin, getAdminActor } from "@/lib/admin-access"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch, shortRequest } from "@/lib/short-request"

export async function setOrderTestRecord(id: string, flagged: boolean) {
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || typeof flagged !== "boolean") return {error:"Invalid order."}
  try {
    const actor = await shortRequest(getAdminActor("operations"),2800)
    if (!actor) return {error:"Operations access is required."}
    const {data,error} = await createAdminClient(boundedFetch(2400)).from("delivery_requests").select("id,status").eq("id",id).maybeSingle()
    if (error) return {error:"The order could not load. Please retry."}
    if (!data || !["delivered","cancelled"].includes(data.status)) return {error:"Only completed or cancelled records can be flagged."}
    await shortRequest(auditAdmin(actor.id,"order_test_record",id,{flagged}),2500)
    // The audit write is already committed. Don't wait for a full order-page refresh.
    return {success:true,flagged}
  } catch { return {error:"Could not confirm the flag. Reload to check the saved status before retrying."} }
}
