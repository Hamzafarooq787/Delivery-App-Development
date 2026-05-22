"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"

export type NotifRole = "admin" | "driver" | "customer"

type Notif = {
  id: string
  title: string
  body: string
  at: number
  read: boolean
}

type Props = {
  role: NotifRole
  userId: string
}

// ── Helpers ────────────────────────────────────────────────────────────────

function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000) return "Just now"
  if (diff < 3_600_000) return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000) return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

type NotifStyle = {
  icon: string
  iconColor: string
  iconBg: string
  accent: string  // left-border color
}

function notifStyle(title: string): NotifStyle {
  if (title.includes("New Driver Message") || title.includes("Support Reply") || title.includes("Chat"))
    return { icon: "chat_bubble", iconColor: "text-[#c180ff]", iconBg: "bg-[#c180ff]/10", accent: "border-[#c180ff]" }
  if (title.includes("Delivered") || title.includes("✅"))
    return { icon: "check_circle", iconColor: "text-emerald-400", iconBg: "bg-emerald-400/10", accent: "border-emerald-500" }
  if (title.includes("New Job") || title.includes("Available"))
    return { icon: "local_shipping", iconColor: "text-[#a3a6ff]", iconBg: "bg-[#a3a6ff]/10", accent: "border-[#a3a6ff]" }
  if (title.includes("New Shipment") || title.includes("Request"))
    return { icon: "inventory_2", iconColor: "text-[#c180ff]", iconBg: "bg-[#c180ff]/10", accent: "border-[#c180ff]" }
  if (title.includes("Way") || title.includes("Transit"))
    return { icon: "directions_car", iconColor: "text-amber-400", iconBg: "bg-amber-400/10", accent: "border-amber-400" }
  if (title.includes("Pick") || title.includes("Collect"))
    return { icon: "inventory", iconColor: "text-sky-400", iconBg: "bg-sky-400/10", accent: "border-sky-400" }
  if (title.includes("Payout") || title.includes("Payment"))
    return { icon: "payments", iconColor: "text-emerald-400", iconBg: "bg-emerald-400/10", accent: "border-emerald-500" }
  if (title.includes("Error") || title.includes("Failed") || title.includes("Cancel"))
    return { icon: "error_outline", iconColor: "text-[#ff6e84]", iconBg: "bg-[#ff6e84]/10", accent: "border-[#ff6e84]" }
  return { icon: "notifications", iconColor: "text-[#4a9fd4]", iconBg: "bg-[#4a9fd4]/10", accent: "border-[#4a9fd4]" }
}

function toastIcon(title: string) {
  const s = notifStyle(title)
  return s.icon === "check_circle" ? "✅"
    : s.icon === "local_shipping" ? "🚚"
    : s.icon === "inventory_2" ? "📦"
    : s.icon === "directions_car" ? "🚗"
    : s.icon === "inventory" ? "📬"
    : s.icon === "payments" ? "💳"
    : s.icon === "error_outline" ? "❌"
    : s.icon === "chat_bubble" ? "💬"
    : "🔔"
}

// Play a short two-tone chime using Web Audio API
function playChime() {
  try {
    const ctx = new AudioContext()
    ;[880, 1100].forEach((freq, i) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = "sine"
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, ctx.currentTime + i * 0.12)
      gain.gain.linearRampToValueAtTime(0.18, ctx.currentTime + i * 0.12 + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + i * 0.12 + 0.35)
      osc.start(ctx.currentTime + i * 0.12)
      osc.stop(ctx.currentTime + i * 0.12 + 0.35)
    })
  } catch {}
}

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission !== "granted") return
  try {
    new Notification(title, { body, icon: "/favicon.ico", tag: title })
  } catch {}
}

function requestNotifPermission() {
  if (typeof window === "undefined") return
  if (!("Notification" in window)) return
  if (Notification.permission === "default") Notification.requestPermission()
}

// ── Component ──────────────────────────────────────────────────────────────

export function RealtimeNotifications({ role, userId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [, tick] = useState(0) // re-render every 30s for relative timestamps

  const unread = notifs.filter((n) => !n.read).length

  // Re-render timestamps every 30s
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { requestNotifPermission() }, [])

  // Load existing notifications
  useEffect(() => {
    if (!userId) return
    supabase
      .from("notifications")
      .select("id, title, body, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30)
      .then(({ data }) => {
        if (!data) return
        setNotifs(
          data.map((r) => ({
            id: r.id,
            title: r.title,
            body: r.body,
            at: new Date(r.created_at).getTime(),
            read: r.read,
          }))
        )
      })
  }, [supabase, userId])

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!userId) return
    let channel: ReturnType<typeof supabase.channel> | null = null

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)

      channel = supabase
        .channel(`notifications-${userId}`)
        .on("postgres_changes", {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        }, (payload) => {
          const row = payload.new as any
          if (!row) return
          const n: Notif = {
            id: row.id,
            title: row.title,
            body: row.body,
            at: new Date(row.created_at).getTime(),
            read: false,
          }
          setNotifs((prev) => {
            if (prev.some((x) => x.id === n.id)) return prev
            return [n, ...prev].slice(0, 30)
          })
          toast(n.title, {
            description: n.body,
            duration: 6000,
            icon: toastIcon(n.title),
          })
          showBrowserNotification(n.title, n.body)
          playChime()
        })
        .subscribe((_, err) => {
          if (err) console.error("[notif] subscription error", err)
        })
    })

    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase, userId])

  // Close on outside click or Escape
  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false)
    }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => {
      document.removeEventListener("mousedown", onMouse)
      document.removeEventListener("keydown", onKey)
    }
  }, [open])

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
    supabase.from("notifications").update({ read: true }).eq("user_id", userId).eq("read", false).then(() => {})
  }

  function clearAll() {
    setNotifs([])
    supabase.from("notifications").delete().eq("user_id", userId).then(() => {})
  }

  function handleOpen() {
    setOpen((v) => !v)
    if (!open && unread > 0) markAllRead()
  }

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell Button ── */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
          open
            ? "bg-[#a3a6ff]/15 text-[#a3a6ff]"
            : "text-[#adaaaa] hover:text-[#a3a6ff] hover:bg-[#a3a6ff]/10"
        }`}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: unread > 0 ? "'FILL' 1" : "'FILL' 0" }}
        >
          notifications
        </span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[#a3a6ff] text-[#0f00a4] text-[9px] font-black flex items-center justify-center leading-none shadow-lg shadow-[#a3a6ff]/40 animate-bounce">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Notification Panel ── */}
      {open && (
        <div
          className="absolute right-0 top-11 w-[340px] max-h-[480px] flex flex-col z-[500] rounded-2xl overflow-hidden
            border border-[#494847]/25 shadow-2xl shadow-black/60
            bg-[#111111]/95 backdrop-blur-2xl"
          style={{ boxShadow: "0 8px 40px rgba(0,0,0,0.55), 0 0 0 1px rgba(163,166,255,0.08)" }}
        >

          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#494847]/20 shrink-0">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-[#a3a6ff]/15 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#a3a6ff] text-base" style={{ fontVariationSettings: "'FILL' 1" }}>
                  notifications
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-white leading-none">Notifications</p>
                <p className="text-[10px] text-[#adaaaa] mt-0.5">
                  {unread > 0 ? `${unread} unread` : "All caught up"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[10px] font-semibold text-[#a3a6ff] hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-[#a3a6ff]/10 transition-all"
                >
                  Mark read
                </button>
              )}
              {notifs.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[10px] font-semibold text-[#adaaaa] hover:text-white px-2.5 py-1.5 rounded-lg hover:bg-[#262626] transition-all"
                >
                  Clear
                </button>
              )}
            </div>
          </div>

          {/* Notification List */}
          <div className="overflow-y-auto flex-1 py-1">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-12 px-6 gap-3">
                <div className="w-14 h-14 rounded-2xl bg-[#1a1919] border border-[#494847]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#494847] text-2xl">notifications_none</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">All quiet here</p>
                  <p className="text-xs text-[#adaaaa] mt-1">New notifications will appear here</p>
                </div>
              </div>
            ) : (
              notifs.map((n) => {
                const s = notifStyle(n.title)
                return (
                  <div
                    key={n.id}
                    className={`relative mx-2 my-1 rounded-xl px-3.5 py-3 border-l-2 transition-all duration-150 cursor-default ${
                      n.read
                        ? "bg-transparent hover:bg-[#1a1919] border-transparent"
                        : "bg-[#1a1919]/80 hover:bg-[#1e1e1e] " + s.accent
                    }`}
                  >
                    <div className="flex gap-3">
                      {/* Icon */}
                      <div className={`w-8 h-8 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${s.iconBg}`}>
                        <span
                          className={`material-symbols-outlined text-base ${s.iconColor}`}
                          style={{ fontVariationSettings: "'FILL' 1" }}
                        >
                          {s.icon}
                        </span>
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-2">
                          <p className={`text-xs font-bold leading-snug ${n.read ? "text-[#adaaaa]" : "text-white"}`}>
                            {n.title}
                          </p>
                          <span className="text-[10px] text-[#494847] whitespace-nowrap shrink-0 mt-0.5">
                            {relativeTime(n.at)}
                          </span>
                        </div>
                        <p className="text-[11px] text-[#adaaaa] mt-0.5 leading-relaxed line-clamp-2">
                          {n.body}
                        </p>
                      </div>

                      {/* Unread dot */}
                      {!n.read && (
                        <div className="w-1.5 h-1.5 rounded-full bg-[#a3a6ff] shrink-0 mt-1.5 shadow-sm shadow-[#a3a6ff]/50" />
                      )}
                    </div>
                  </div>
                )
              })
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="border-t border-[#494847]/20 px-4 py-2.5 shrink-0 flex items-center justify-center">
              <p className="text-[10px] text-[#494847]">
                {notifs.length} notification{notifs.length !== 1 ? "s" : ""}
                {unread > 0 ? ` · ${unread} unread` : " · all read"}
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
