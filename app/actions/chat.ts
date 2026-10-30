"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

async function getCallerRole(userId: string): Promise<string | null> {
  const admin = createAdminClient()
  const { data } = await admin.from("users").select("role").eq("id", userId).maybeSingle()
  return data?.role ?? null
}

export type ChatMessage = {
  id: string
  session_id: string
  sender_id: string
  sender_role: "driver" | "admin"
  content: string
  created_at: string
}

export type ChatSession = {
  id: string
  driver_id: string
  driver_unread: number
  admin_unread: number
  last_message_at: string
  driver_name?: string
  last_message?: string
}

// ── Driver: get or create their chat session ─────────────────────────────────
export async function getOrCreateChatSession(): Promise<{ sessionId: string | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { sessionId: null, error: "Not authenticated" }

  const admin = createAdminClient()

  // Try to get existing session
  const { data: existing } = await admin
    .from("chat_sessions")
    .select("id")
    .eq("driver_id", user.id)
    .single()

  if (existing) return { sessionId: existing.id }

  // Create new session
  const { data: created, error } = await admin
    .from("chat_sessions")
    .insert({ driver_id: user.id })
    .select("id")
    .single()

  if (error) return { sessionId: null, error: error.message }
  return { sessionId: created.id }
}

// ── Get messages for a session ───────────────────────────────────────────────
export async function getChatMessages(sessionId: string, before?: { created_at: string; id: string }): Promise<{ data: ChatMessage[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Not authenticated" }

  const admin = createAdminClient()

  const role = await getCallerRole(user.id)
  if (role !== "admin") {
    // A driver may only read their own session.
    const { data: session } = await admin.from("chat_sessions").select("driver_id").eq("id", sessionId).maybeSingle()
    if (!session || session.driver_id !== user.id) return { data: [], error: "Not authorized" }
  }

  let query = admin.from("chat_messages").select("id, session_id, sender_id, sender_role, content, created_at").eq("session_id",sessionId)
  if(before){
    if(!/^[0-9a-f-]{36}$/i.test(before.id)||!Number.isFinite(Date.parse(before.created_at)))return {data:[],error:"Invalid message cursor"}
    const time=new Date(before.created_at).toISOString()
    query=query.or(`created_at.lt.${time},and(created_at.eq.${time},id.lt.${before.id})`)
  }
  const {data,error}=await query.order("created_at",{ascending:false}).order("id",{ascending:false}).limit(100)

  if (error) return { data: [], error: error.message }
  return { data: (data ?? []).reverse() as ChatMessage[] }
}

// ── Send a message ───────────────────────────────────────────────────────────
export async function sendChatMessage(
  sessionId: string,
  content: string,
  senderRole: "driver" | "admin"
): Promise<{ data: ChatMessage | null; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: null, error: "Not authenticated" }

  if(!content.trim() || content.length>4000)return {data:null,error:"Write a message of 1–4000 characters"}
  const admin = createAdminClient()

  // Never trust the caller's claimed role or session — verify both, so a
  // driver can't post into another driver's session or impersonate admin.
  const actualRole = await getCallerRole(user.id)
  if (senderRole !== actualRole) return { data: null, error: "Role mismatch" }

  if (senderRole === "driver") {
    const { data: session } = await admin.from("chat_sessions").select("driver_id").eq("id", sessionId).maybeSingle()
    if (!session || session.driver_id !== user.id) return { data: null, error: "Not authorized" }
  } else if (senderRole !== "admin") {
    return { data: null, error: "Invalid sender role" }
  }

  const { data, error } = await admin
    .from("chat_messages")
    .insert({ session_id: sessionId, sender_id: user.id, sender_role: senderRole, content: content.trim() })
    .select()
    .single()

  if (error) return { data: null, error: error.message }
  return { data: data as ChatMessage }
}

// ── Admin: get all sessions with last message + driver name ─────────────────
export async function getAdminChatSessions(): Promise<{ data: ChatSession[] }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (await getCallerRole(user.id)) !== "admin") return { data: [] }

  const admin = createAdminClient()

  const { data: sessions } = await admin
    .from("chat_sessions")
    .select("id, driver_id, driver_unread, admin_unread, last_message_at")
    .order("last_message_at", { ascending: false })
    .limit(50)

  if (!sessions || sessions.length === 0) return { data: [] }

  // Fetch driver names
  const driverIds = sessions.map((s: any) => s.driver_id)
  const { data: users } = await admin.from("users").select("id, full_name, email").in("id", driverIds)
  const userMap: Record<string, string> = {}
  for (const u of users ?? []) {
    userMap[(u as any).id] = (u as any).full_name || (u as any).email || "Driver"
  }

  // Fetch last message per session
  const sessionIds = sessions.map((s: any) => s.id)
  const lastMsgMap: Record<string, string> = {}
  for (const sid of sessionIds) {
    const { data: msgs } = await admin
      .from("chat_messages")
      .select("content, sender_role")
      .eq("session_id", sid)
      .order("created_at", { ascending: false })
      .limit(1)
    if (msgs && msgs.length > 0) {
      const m = msgs[0] as any
      lastMsgMap[sid] = (m.sender_role === "admin" ? "You: " : "") + m.content
    }
  }

  const result: ChatSession[] = sessions.map((s: any) => ({
    id: s.id,
    driver_id: s.driver_id,
    driver_unread: s.driver_unread,
    admin_unread: s.admin_unread,
    last_message_at: s.last_message_at,
    driver_name: userMap[s.driver_id] ?? "Driver",
    last_message: lastMsgMap[s.id] ?? "",
  }))

  return { data: result }
}

// ── Mark session read (reset unread counter) ────────────────────────────────
export async function markChatSessionRead(sessionId: string, role: "driver" | "admin"): Promise<void> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return

  const admin = createAdminClient()
  const actualRole = await getCallerRole(user.id)

  if (role === "driver") {
    const { data: session } = await admin.from("chat_sessions").select("driver_id").eq("id", sessionId).maybeSingle()
    if (!session || session.driver_id !== user.id) return
  } else if (actualRole !== "admin") {
    return
  }

  const field = role === "driver" ? "driver_unread" : "admin_unread"
  await admin.from("chat_sessions").update({ [field]: 0 }).eq("id", sessionId)
}

// ── Get total admin unread count ─────────────────────────────────────────────
export async function getAdminTotalUnread(): Promise<number> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || (await getCallerRole(user.id)) !== "admin") return 0

  const admin = createAdminClient()
  const { data } = await admin.from("chat_sessions").select("admin_unread")
  return (data ?? []).reduce((s: number, r: any) => s + (r.admin_unread ?? 0), 0)
}
