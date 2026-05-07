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

function toastIcon(title: string) {
  if (title === "Delivered!") return "✅"
  if (title === "New Shipment Request") return "📦"
  if (title === "New Job Available") return "🚚"
  if (title.includes("Way")) return "🚗"
  if (title.includes("Picked")) return "📬"
  if (title.includes("Transit")) return "🛣️"
  return "🔔"
}

export function RealtimeNotifications({ role, userId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => !n.read).length

  // Subscribe to the notifications table filtered by this user's id
  useEffect(() => {
    if (!userId) return

    const channel = supabase
      .channel(`notifications-${userId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "notifications",
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const row = payload.new as any
          if (!row) return
          const n: Notif = {
            id: row.id,
            title: row.title,
            body: row.body,
            at: new Date(row.created_at).getTime(),
            read: false,
          }
          setNotifs((prev) => [n, ...prev].slice(0, 30))
          toast(n.title, {
            description: n.body,
            duration: 6000,
            icon: toastIcon(n.title),
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, userId])

  // Close panel on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener("mousedown", handle)
    return () => document.removeEventListener("mousedown", handle)
  }, [open])

  function markAllRead() {
    setNotifs((prev) => prev.map((n) => ({ ...n, read: true })))
  }

  return (
    <div className="relative" ref={panelRef}>
      <button
        onClick={() => { setOpen((v) => !v); if (!open) markAllRead() }}
        className="relative text-[#adaaaa] hover:text-[#a3a6ff] transition-colors"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unread > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-0.5 rounded-full bg-[#a3a6ff] text-[#0f00a4] text-[9px] font-black flex items-center justify-center">
            {unread > 9 ? "9+" : unread}
          </span>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-10 w-80 max-h-96 bg-[#1a1919] border border-[#494847]/20 rounded-2xl shadow-2xl overflow-hidden z-[500] flex flex-col">
          <div className="flex items-center justify-between px-4 py-3 border-b border-[#494847]/15 shrink-0">
            <p className="text-xs font-bold text-white uppercase tracking-wider">Notifications</p>
            {notifs.length > 0 && (
              <button onClick={() => setNotifs([])} className="text-[10px] text-[#adaaaa] hover:text-white">
                Clear all
              </button>
            )}
          </div>

          <div className="overflow-y-auto flex-1">
            {notifs.length === 0 ? (
              <div className="px-4 py-8 text-center">
                <span className="material-symbols-outlined text-[#494847] text-3xl">notifications_none</span>
                <p className="text-xs text-[#adaaaa] mt-2">No notifications yet</p>
              </div>
            ) : (
              notifs.map((n) => (
                <div
                  key={n.id}
                  className="px-4 py-3 border-b border-[#494847]/10 hover:bg-[#262626] transition-colors"
                >
                  <p className="text-xs font-bold text-white">{n.title}</p>
                  <p className="text-[11px] text-[#adaaaa] mt-0.5 leading-relaxed">{n.body}</p>
                  <p className="text-[10px] text-[#494847] mt-1">
                    {new Date(n.at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  )
}
