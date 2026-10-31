/**
 * app/actions/support.ts
 * ─────────────────────────────────────────────────────────────────────────────
 * Admin-side server actions for support tickets.
 * (Customer/driver ticket creation lives in app/actions/driver.ts —
 * getMyTickets / createSupportTicket, which are role-agnostic.)
 */
"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type AdminSupportTicket = {
  id: string
  subject: string
  message: string
  status: "open" | "closed"
  created_at: string
  user_name: string
  user_role: string
}

/** Require the current user to be an admin; returns their id or null. */
async function requireAdmin(): Promise<string | null> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase.from("users").select("role").eq("id", user.id).maybeSingle()
  return data?.role === "admin" ? user.id : null
}

export async function adminGetSupportTickets(): Promise<{ data: AdminSupportTicket[]; error?: string }> {
  if (!(await requireAdmin())) return { data: [], error: "Not authorized" }

  const admin = createAdminClient()
  const { data: tickets, error } = await admin
    .from("support_tickets")
    .select("id, user_id, subject, message, status, created_at")
    .order("created_at", { ascending: false })
    .limit(200)

  if (error) return { data: [], error: error.message }
  if (!tickets || tickets.length === 0) return { data: [] }

  const userIds = [...new Set(tickets.map((t) => t.user_id).filter(Boolean))]
  const { data: users } = await admin
    .from("users")
    .select("id, full_name, role")
    .in("id", userIds)

  const userMap = new Map((users ?? []).map((u) => [u.id, u]))

  return {
    data: tickets.map((t) => {
      const u = t.user_id ? userMap.get(t.user_id) : undefined
      return {
        id: t.id,
        subject: t.subject ?? "",
        message: t.message ?? "",
        status: (t.status ?? "open") as "open" | "closed",
        created_at: t.created_at,
        user_name: u?.full_name ?? "Unknown user",
        user_role: u?.role ?? "customer",
      }
    }),
  }
}

export async function adminSetTicketStatus(
  ticketId: string,
  status: "open" | "closed"
): Promise<{ success?: boolean; error?: string }> {
  if (!(await requireAdmin())) return { error: "Not authorized" }
  if (!["open","closed"].includes(status)) return {error:"Choose Open or Resolved."}

  const admin = createAdminClient()
  const { error } = await admin
    .from("support_tickets")
    .update({ status })
    .eq("id", ticketId)

  if (error) return { error: error.message }

  revalidatePath("/dashboard/admin/support")
  revalidatePath("/dashboard/driver/support")
  revalidatePath("/dashboard/customer/support")
  return { success: true }
}
