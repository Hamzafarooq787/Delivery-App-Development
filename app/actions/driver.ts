"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import {after} from "next/server"
import {notifySupportUpdate} from "@/lib/notifications/internal"
import { revalidatePath } from "next/cache"

export type SupportTicket = {
  id: string
  customer_unread?:number
  subject: string
  message: string
  status: "open" | "closed"
  created_at: string
}

export async function getMyTickets(): Promise<{ data: SupportTicket[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [] }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("support_tickets")
    .select("id, subject, message, status, created_at, customer_unread")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []) as SupportTicket[] }
}

export async function createSupportTicket(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const subject = (formData.get("subject") as string ?? "").trim()
  const message = (formData.get("message") as string ?? "").trim()
  if (!subject || !message || subject.length > 180 || message.length > 4000) return { error: "Subject and message are required" }

  const admin = createAdminClient()
  const { data, error } = await admin.from("support_tickets").insert({
    user_id: user.id,
    subject,
    message,
    status: "open",
  }).select("id,subject,message,status,created_at,customer_unread").single()

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/support")
  revalidatePath("/dashboard/customer/support")
  after(async()=>{await notifySupportUpdate(data.id,user.id,data.id)})
  return { success: true, data: data as SupportTicket }
}

export async function toggleDriverOnline(isOnline: boolean) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const { data: profile } = await admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle()
  if (!profile || (isOnline && profile.status !== "approved")) return { error: "Your driver account must be approved before going online." }
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, is_online: isOnline }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

/**
 * Save notification preferences.
 * Requires columns notifications_enabled and delivery_alerts on driver_profiles.
 * Run scripts/014_driver_settings.sql if these columns don't exist yet.
 */
export async function updateDriverNotifications(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const notifications_enabled = formData.get("notifications_enabled") === "1"
  const delivery_alerts       = formData.get("delivery_alerts")       === "1"

  const admin = createAdminClient()
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, notifications_enabled, delivery_alerts }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/settings")
  return { success: true }
}

/** Change the driver's password via Supabase Auth admin API. */
export async function changeDriverPassword(formData: FormData) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const newPassword     = (formData.get("new_password")     as string ?? "").trim()
  const confirmPassword = (formData.get("confirm_password") as string ?? "").trim()

  if (!newPassword)                    return { error: "New password is required" }
  if (newPassword.length < 8)          return { error: "Password must be at least 8 characters" }
  if (newPassword !== confirmPassword) return { error: "Passwords do not match" }

  const admin = createAdminClient()
  const { error } = await admin.auth.admin.updateUserById(user.id, { password: newPassword })

  if (error) return { error: error.message }
  return { success: true }
}

export async function getDriverNamesByIds(driverIds: string[]): Promise<Record<string, string>> {
  const session = await createClient()
  const { data: { user } } = await session.auth.getUser()
  if (!user || !Array.isArray(driverIds)) return {}
  const ids = [...new Set(driverIds)].filter(id => typeof id === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id)).slice(0,100)
  if (!ids.length) return {}
  const admin = createAdminClient()
  const { data: caller, error: callerError } = await admin.from('users').select('role').eq('id',user.id).maybeSingle()
  if (callerError) return {}
  let allowed = ids
  if (caller?.role !== 'admin') {
    const { data: jobs, error } = await admin.from('delivery_requests').select('driver_id').eq('customer_id',user.id).in('driver_id',ids)
    if (error) return {}
    allowed = [...new Set((jobs ?? []).map(job=>job.driver_id))].filter((id): id is string => typeof id === 'string')
  }
  if (!allowed.length) return {}
  const { data } = await admin
    .from("users")
    .select("id, full_name")
    .in("id", allowed)
  const map: Record<string, string> = {}
  for (const u of data ?? []) {
    map[(u as any).id] = (u as any).full_name ?? "Driver"
  }
  return map
}

export async function getDriverTickets(page=1){
 const db=await createClient();const {data:{user}}=await db.auth.getUser()
 if(!user)return {data:[] as SupportTicket[],count:0,error:'Please sign in again.'}
 const offset=(Math.max(1,Math.min(Math.trunc(page)||1,1000000))-1)*20
 const {data,error,count}=await createAdminClient().from('support_tickets').select('id,subject,message,status,created_at,customer_unread',{count:'exact'}).eq('user_id',user.id).order('created_at',{ascending:false}).order('id',{ascending:false}).range(offset,offset+19)
 return {data:(data??[]) as SupportTicket[],count:count??0,error:error?'Could not load support requests. Please retry.':undefined}
}

export async function getMySupportTicket(id:string){const session=await createClient();const {data:{user}}=await session.auth.getUser();if(!user||!/^[0-9a-f-]{36}$/i.test(id))return{error:'Support request unavailable.'};const {data,error}=await createAdminClient().from('support_tickets').select('id,subject,message,status,created_at,customer_unread').eq('id',id).eq('user_id',user.id).maybeSingle();return error||!data?{error:'Support request unavailable.'}:{data:data as SupportTicket}}
