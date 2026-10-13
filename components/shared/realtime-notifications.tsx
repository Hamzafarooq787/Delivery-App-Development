"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { createClient } from "@/lib/supabase/client"
import { toast } from "sonner"
import { playNotificationSound, primeAudio, requestNotificationPermission } from "@/lib/notification-sound"

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

// ── Relative timestamp ─────────────────────────────────────────────────────
function relativeTime(ms: number): string {
  const diff = Date.now() - ms
  if (diff < 60_000)      return "Just now"
  if (diff < 3_600_000)   return `${Math.floor(diff / 60_000)}m ago`
  if (diff < 86_400_000)  return `${Math.floor(diff / 3_600_000)}h ago`
  return `${Math.floor(diff / 86_400_000)}d ago`
}

// ── Notification style ─────────────────────────────────────────────────────
type NotifStyle = {
  icon: string
  iconColor: string
  iconBg: string
  accent: string
  pill: string
}

function notifStyle(title: string): NotifStyle {
  if (title.includes("New Driver Message") || title.includes("Support Reply") || title.includes("Chat"))
    return { icon: "chat_bubble",    iconColor: "text-[var(--color-secondary)]",  iconBg: "bg-[var(--color-secondary)]/10",  accent: "border-[var(--color-secondary)]",  pill: "bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]" }
  if (title.includes("Delivered"))
    return { icon: "check_circle",   iconColor: "text-emerald-400", iconBg: "bg-emerald-400/10", accent: "border-emerald-500", pill: "bg-emerald-500/15 text-emerald-400" }
  if (title.includes("New Job") || title.includes("Available"))
    return { icon: "local_shipping", iconColor: "text-[var(--color-primary)]",  iconBg: "bg-[var(--color-primary)]/10",  accent: "border-[var(--color-primary)]",  pill: "bg-[var(--color-primary)]/15 text-[var(--color-primary)]" }
  if (title.includes("New Shipment") || title.includes("Request"))
    return { icon: "inventory_2",    iconColor: "text-[var(--color-secondary)]",  iconBg: "bg-[var(--color-secondary)]/10",  accent: "border-[var(--color-secondary)]",  pill: "bg-[var(--color-secondary)]/15 text-[var(--color-secondary)]" }
  if (title.includes("Way") || title.includes("Transit"))
    return { icon: "directions_car", iconColor: "text-amber-400",  iconBg: "bg-amber-400/10",  accent: "border-amber-400",  pill: "bg-amber-400/15 text-amber-400" }
  if (title.includes("Pick") || title.includes("Collect"))
    return { icon: "inventory",      iconColor: "text-sky-400",    iconBg: "bg-sky-400/10",    accent: "border-sky-400",    pill: "bg-sky-400/15 text-sky-400" }
  if (title.includes("Payout") || title.includes("Payment"))
    return { icon: "payments",       iconColor: "text-emerald-400", iconBg: "bg-emerald-400/10", accent: "border-emerald-500", pill: "bg-emerald-500/15 text-emerald-400" }
  if (title.includes("Error") || title.includes("Failed") || title.includes("Cancel"))
    return { icon: "error_outline",  iconColor: "text-[#ff6e84]",  iconBg: "bg-[#ff6e84]/10",  accent: "border-[#ff6e84]",  pill: "bg-[#ff6e84]/15 text-[#ff6e84]" }
  return   { icon: "notifications",  iconColor: "text-[#4a9fd4]",  iconBg: "bg-[#4a9fd4]/10",  accent: "border-[#4a9fd4]",  pill: "bg-[#4a9fd4]/15 text-[#4a9fd4]" }
}

function toastIcon(title: string) {
  const s = notifStyle(title)
  const map: Record<string, string> = {
    check_circle: "✅", local_shipping: "🚚", inventory_2: "📦",
    directions_car: "🚗", inventory: "📬", payments: "💳",
    error_outline: "❌", chat_bubble: "💬",
  }
  return map[s.icon] ?? "🔔"
}

// ── Click action per role + title ──────────────────────────────────────────
function getClickAction(
  title: string,
  role: NotifRole,
  router: ReturnType<typeof useRouter>,
  closePanel: () => void,
) {
  function go(path: string) { closePanel(); router.push(path) }
  function event(name: string) { closePanel(); window.dispatchEvent(new CustomEvent(name)) }

  // Chat
  if (title.includes("New Driver Message") || title.includes("Support Reply") || title.includes("Chat")) {
    if (role === "admin")    return () => event("open-admin-chat")
    if (role === "driver")   return () => event("open-driver-chat")
    return null
  }
  // New shipment / order requests
  if (title.includes("New Shipment") || title.includes("Request")) {
    if (role === "admin")    return () => go("/dashboard/admin/orders")
    if (role === "driver")   return () => go("/dashboard/driver/jobs/available")
    return null
  }
  // New job for driver
  if (title.includes("New Job") || title.includes("Available")) {
    if (role === "driver")   return () => go("/dashboard/driver/jobs/available")
    return null
  }
  // Delivery status updates → customer tracks their order
  if (title.includes("Driver On") || title.includes("Way") || title.includes("Pick") ||
      title.includes("Collect") || title.includes("Transit") || title.includes("Delivered")) {
    if (role === "customer") return () => go("/dashboard/customer/tracking")
    if (role === "driver")   return () => go("/dashboard/driver/active-jobs")
    if (role === "admin")    return () => go("/dashboard/admin/orders")
    return null
  }
  // Payouts
  if (title.includes("Payout") || title.includes("Payment")) {
    if (role === "driver")   return () => go("/dashboard/driver/earnings")
    if (role === "admin")    return () => go("/dashboard/admin/payouts")
    return null
  }
  return null
}

// ── Audio chime — delegates to shared utility (respects user's volume + sound type prefs) ──

function showBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return
  if (Notification.permission !== "granted") return
  try { new Notification(title, { body, icon: "/favicon.ico", tag: title }) } catch {}
}

function requestNotifPermission() {
  requestNotificationPermission().catch(() => {})
}

// ── Labels for action hint ─────────────────────────────────────────────────
function actionLabel(title: string, role: NotifRole): string | null {
  if (title.includes("New Driver Message") || title.includes("Support Reply") || title.includes("Chat")) {
    return role === "admin" ? "Open chat inbox →" : "Open chat →"
  }
  if (title.includes("New Shipment") || title.includes("Request")) {
    return role === "admin" ? "View orders →" : role === "driver" ? "Browse jobs →" : null
  }
  if (title.includes("New Job") || title.includes("Available")) return "Browse available jobs →"
  if (title.includes("Driver On") || title.includes("Way") || title.includes("Pick") ||
      title.includes("Collect") || title.includes("Transit") || title.includes("Delivered")) {
    return role === "customer" ? "Track shipment →"
      : role === "driver" ? "View active jobs →"
      : role === "admin" ? "View orders →" : null
  }
  if (title.includes("Payout") || title.includes("Payment")) {
    return role === "driver" ? "View earnings →" : role === "admin" ? "View payouts →" : null
  }
  return null
}

// ══════════════════════════════════════════════════════════════════════════
// Component
// ══════════════════════════════════════════════════════════════════════════

// Set to true to re-enable in-app realtime notifications and chat notification toasts.
const REALTIME_NOTIFICATIONS_ENABLED = false

export function RealtimeNotifications({ role, userId }: Props) {
  const router  = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const [notifs, setNotifs]   = useState<Notif[]>([])
  const [open, setOpen]       = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const [, tick] = useState(0)

  const unread = notifs.filter((n) => !n.read).length

  function closePanel() { setOpen(false) }

  // Timestamps refresh every 30s
  useEffect(() => {
    const id = setInterval(() => tick((t) => t + 1), 30_000)
    return () => clearInterval(id)
  }, [])

  useEffect(() => { requestNotifPermission() }, [])

  // Prime the Web Audio context on the user's first interaction so the
  // singleton AudioContext is already "running" when a notification arrives.
  useEffect(() => {
    const prime = () => {
      primeAudio()
      document.removeEventListener("click", prime, true)
      document.removeEventListener("keydown", prime, true)
    }
    document.addEventListener("click",   prime, true)
    document.addEventListener("keydown", prime, true)
    return () => {
      document.removeEventListener("click",   prime, true)
      document.removeEventListener("keydown", prime, true)
    }
  }, [])

  // Initial load
  useEffect(() => {
    if (!userId) return
    supabase
      .from("notifications")
      .select("id, title, body, read, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50)
      .then(({ data }) => {
        if (!data) return
        setNotifs(data.map((r) => ({
          id: r.id, title: r.title, body: r.body,
          at: new Date(r.created_at).getTime(), read: r.read,
        })))
      })
  }, [supabase, userId])

  // Realtime subscription
  useEffect(() => {
    if (!REALTIME_NOTIFICATIONS_ENABLED) return
    if (!userId) return
    let channel: ReturnType<typeof supabase.channel> | null = null
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.access_token) supabase.realtime.setAuth(session.access_token)
      channel = supabase
        .channel(`notifications-${userId}`)
        .on("postgres_changes", { event: "INSERT", schema: "public", table: "notifications", filter: `user_id=eq.${userId}` },
          (payload) => {
            const row = payload.new as any
            if (!row) return
            const n: Notif = { id: row.id, title: row.title, body: row.body, at: new Date(row.created_at).getTime(), read: false }
            setNotifs((prev) => prev.some((x) => x.id === n.id) ? prev : [n, ...prev].slice(0, 50))
            showBrowserNotification(n.title, n.body)
            playNotificationSound()
            // Chat notifications → custom clickable toast with close button
            const isChatToast = notifStyle(n.title).icon === "chat_bubble"
            if (isChatToast) {
              toast.custom(
                (id) => (
                  <button
                    type="button"
                    onClick={() => {
                      toast.dismiss(id)
                      if (role === "admin") window.dispatchEvent(new CustomEvent("open-admin-chat"))
                      else if (role === "driver") window.dispatchEvent(new CustomEvent("open-driver-chat"))
                    }}
                    className="w-full flex items-center gap-3 bg-[#1a1919] border border-[var(--color-secondary)]/30 rounded-2xl px-4 py-3.5 shadow-2xl shadow-black/50 text-left group hover:border-[var(--color-secondary)]/60 transition-all"
                  >
                    <div className="w-10 h-10 rounded-xl bg-[var(--color-secondary)]/15 flex items-center justify-center shrink-0">
                      <span className="material-symbols-outlined text-[var(--color-secondary)] text-xl" style={{ fontVariationSettings: "'FILL' 1" }}>chat_bubble</span>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-bold text-white leading-snug">{n.title}</p>
                      <p className="text-xs text-[#adaaaa] truncate mt-0.5">{n.body}</p>
                      <p className="text-[11px] text-[var(--color-secondary)] font-semibold mt-1">Tap to open chat →</p>
                    </div>
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={(e) => { e.stopPropagation(); toast.dismiss(id) }}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.stopPropagation(); toast.dismiss(id) } }}
                      className="w-6 h-6 rounded-full bg-[#262626] flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#333] shrink-0 transition-colors"
                    >
                      <span className="material-symbols-outlined text-[13px]">close</span>
                    </div>
                  </button>
                ),
                { duration: 8000 }
              )
            } else {
              toast(n.title, { description: n.body, duration: 6000, icon: toastIcon(n.title), closeButton: true })
            }
          })
        .subscribe((_, err) => { if (err) console.error("[notif] subscription error", err) })
    })
    return () => { if (channel) supabase.removeChannel(channel) }
  }, [supabase, userId])

  // Close on outside click (desktop) or Escape
  useEffect(() => {
    if (!open) return
    function onMouse(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    function onKey(e: KeyboardEvent) { if (e.key === "Escape") setOpen(false) }
    document.addEventListener("mousedown", onMouse)
    document.addEventListener("keydown", onKey)
    return () => { document.removeEventListener("mousedown", onMouse); document.removeEventListener("keydown", onKey) }
  }, [open])

  // Prevent body scroll when mobile sheet is open
  useEffect(() => {
    if (open) document.body.style.overflow = "hidden"
    else document.body.style.overflow = ""
    return () => { document.body.style.overflow = "" }
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
    primeAudio()   // user gesture → unlocks AudioContext for future notifications
    const next = !open
    setOpen(next)
    if (next && unread > 0) markAllRead()
  }

  return (
    <div className="relative" ref={panelRef}>

      {/* ── Bell Button ── */}
      <button
        onClick={handleOpen}
        aria-label="Notifications"
        className={`relative w-9 h-9 rounded-xl flex items-center justify-center transition-all duration-200 ${
          open ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]" : "text-[#adaaaa] hover:text-[var(--color-primary)] hover:bg-[var(--color-primary)]/10"
        }`}
      >
        <span
          className="material-symbols-outlined text-[22px]"
          style={{ fontVariationSettings: unread > 0 ? "'FILL' 1" : "'FILL' 0" }}
        >
          notifications
        </span>
        {unread > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-[var(--color-primary)] text-[var(--color-on-primary)] text-[9px] font-black flex items-center justify-center leading-none shadow-lg shadow-[var(--color-primary)]/40 animate-bounce">
            {unread > 99 ? "99+" : unread}
          </span>
        )}
      </button>

      {/* ── Mobile backdrop ── */}
      {open && (
        <div
          className="fixed inset-0 z-[490] bg-black/60 backdrop-blur-sm md:hidden"
          onClick={closePanel}
        />
      )}

      {/* ── Panel: bottom sheet on mobile, dropdown on desktop ── */}
      {open && (
        <div
          className={`
            z-[500] flex flex-col overflow-hidden
            bg-[#111111]/98 backdrop-blur-2xl border border-[#494847]/25
            shadow-2xl shadow-black/70

            /* Mobile: full-width bottom sheet */
            fixed bottom-0 left-0 right-0 rounded-t-3xl max-h-[82vh]
            md:absolute md:bottom-auto md:left-auto
            md:right-0 md:top-11 md:w-[380px] md:max-h-[520px]
            md:rounded-2xl md:rounded-t-2xl
          `}
          style={{ boxShadow: "0 -4px 40px rgba(0,0,0,0.6), 0 0 0 1px rgba(var(--brand-rgb),0.08)" }}
        >
          {/* Mobile drag handle */}
          <div className="md:hidden flex justify-center pt-3 pb-1 shrink-0">
            <div className="w-10 h-1 rounded-full bg-[#494847]/60" />
          </div>

          {/* Header */}
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#494847]/20 shrink-0">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-xl bg-[var(--color-primary)]/15 flex items-center justify-center shrink-0">
                <span className="material-symbols-outlined text-[var(--color-primary)] text-[18px]" style={{ fontVariationSettings: "'FILL' 1" }}>
                  notifications
                </span>
              </div>
              <div>
                <p className="text-[15px] font-bold text-white leading-none">Notifications</p>
                <p className="text-[11px] text-[#adaaaa] mt-0.5">
                  {unread > 0 ? `${unread} new` : "All caught up"}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1">
              {unread > 0 && (
                <button
                  onClick={markAllRead}
                  className="text-[11px] font-semibold text-[var(--color-primary)] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[var(--color-primary)]/10 transition-all"
                >
                  Mark all read
                </button>
              )}
              {notifs.length > 0 && (
                <button
                  onClick={clearAll}
                  className="text-[11px] font-semibold text-[#adaaaa] hover:text-white px-3 py-1.5 rounded-lg hover:bg-[#262626] transition-all"
                >
                  Clear
                </button>
              )}
              <button
                onClick={closePanel}
                className="ml-1 w-7 h-7 rounded-lg flex items-center justify-center text-[#adaaaa] hover:text-white hover:bg-[#262626] transition-all md:hidden"
              >
                <span className="material-symbols-outlined text-[18px]">close</span>
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="overflow-y-auto flex-1 py-2">
            {notifs.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-16 px-6 gap-4">
                <div className="w-16 h-16 rounded-2xl bg-[#1a1919] border border-[#494847]/20 flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#494847] text-3xl">notifications_none</span>
                </div>
                <div className="text-center">
                  <p className="text-sm font-bold text-white">All quiet here</p>
                  <p className="text-xs text-[#adaaaa] mt-1.5 leading-relaxed max-w-[200px]">
                    Delivery updates, messages, and alerts will show up here
                  </p>
                </div>
              </div>
            ) : (
              <div className="px-3 space-y-1">
                {notifs.map((n) => {
                  const s      = notifStyle(n.title)
                  const action = getClickAction(n.title, role, router, closePanel)
                  const hint   = actionLabel(n.title, role)
                  const clickable = action !== null

                  return (
                    <div
                      key={n.id}
                      onClick={action ?? undefined}
                      className={`
                        relative rounded-2xl px-4 py-3.5 border-l-[3px] transition-all duration-150 select-none
                        ${clickable ? "cursor-pointer active:scale-[0.98]" : "cursor-default"}
                        ${n.read
                          ? `border-transparent ${clickable ? "hover:bg-[#1a1919]" : ""}`
                          : `bg-[#1a1919] ${clickable ? "hover:bg-[#1e1e1e]" : ""} ${s.accent}`
                        }
                      `}
                    >
                      <div className="flex gap-3.5 items-start">
                        {/* Icon */}
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center shrink-0 ${s.iconBg}`}>
                          <span
                            className={`material-symbols-outlined text-[18px] ${s.iconColor}`}
                            style={{ fontVariationSettings: "'FILL' 1" }}
                          >
                            {s.icon}
                          </span>
                        </div>

                        {/* Content */}
                        <div className="flex-1 min-w-0">
                          <div className="flex items-start justify-between gap-2 mb-0.5">
                            <p className={`text-[13px] font-bold leading-snug ${n.read ? "text-[#adaaaa]" : "text-white"}`}>
                              {n.title}
                            </p>
                            <span className="text-[10px] text-[#494847] whitespace-nowrap shrink-0 mt-0.5">
                              {relativeTime(n.at)}
                            </span>
                          </div>
                          <p className="text-[12px] text-[#adaaaa] leading-relaxed line-clamp-2">
                            {n.body}
                          </p>
                          {clickable && hint && (
                            <span className={`inline-flex items-center gap-1 mt-1.5 text-[11px] font-semibold ${s.iconColor}`}>
                              {hint}
                              <span className="material-symbols-outlined text-[12px]">arrow_forward</span>
                            </span>
                          )}
                        </div>

                        {/* Unread dot */}
                        {!n.read && (
                          <div className={`w-2 h-2 rounded-full shrink-0 mt-1.5 ${s.iconColor.replace("text-", "bg-")} shadow-sm`} />
                        )}
                      </div>
                    </div>
                  )
                })}
              </div>
            )}
          </div>

          {/* Footer */}
          {notifs.length > 0 && (
            <div className="border-t border-[#494847]/20 px-5 py-3.5 shrink-0 flex items-center justify-between">
              <p className="text-[11px] text-[#494847]">
                {notifs.length} notification{notifs.length !== 1 ? "s" : ""}
                {unread > 0 ? ` · ${unread} unread` : " · all read"}
              </p>
              <div className={`text-[10px] font-bold px-2 py-1 rounded-full ${unread > 0 ? "bg-[var(--color-primary)]/15 text-[var(--color-primary)]" : "bg-[#262626] text-[#494847]"}`}>
                {unread > 0 ? `${unread} NEW` : "CAUGHT UP"}
              </div>
            </div>
          )}

          {/* Bottom safe area spacing for mobile */}
          <div className="md:hidden h-safe-bottom shrink-0" style={{ height: "env(safe-area-inset-bottom, 12px)" }} />
        </div>
      )}
    </div>
  )
}

