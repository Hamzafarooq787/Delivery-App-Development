"use server"
import { revalidatePath } from "next/cache"
import { auditAdmin, getAdminActor } from "@/lib/admin-access"
import { createAdminClient } from "@/lib/supabase/admin"

export async function setOrderTestRecord(id: string, flagged: boolean) {
  const actor = await getAdminActor("operations")
  if (!actor) return {error:"Operations access is required."}
  if (typeof id !== "string" || !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id) || typeof flagged !== "boolean") return {error:"Invalid order."}
  const {data,error} = await createAdminClient().from("delivery_requests").select("id,status").eq("id",id).maybeSingle()
  if (error || !data || !["delivered","cancelled"].includes(data.status)) return {error:"Only completed or cancelled records can be flagged."}
  try {
    await auditAdmin(actor.id,"order_test_record",id,{flagged})
  } catch { return {error:"Could not save the flag. Please retry."} }
  revalidatePath(`/dashboard/admin/orders/${id}`)
  return {success:true}
}
