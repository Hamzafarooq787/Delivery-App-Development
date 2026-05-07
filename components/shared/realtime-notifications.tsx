"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { createClient } from "@/lib/supabase/client"

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

function buildNotif(role: NotifRole, payload: any): Notif | null {
  const row = (payload.new ?? payload.old) as Record<string, any> | null
  if (!row) return null
  const event = payload.eventType as string

  const tn = row.tracking_number ? `#${row.tracking_number}` : `#${String(row.id).slice(0, 8).toUpperCase()}`

  if (role === "admin" && event === "INSERT") {
    return { id: row.id, title: "New Shipment Request", body: `${tn} — ${row.pickup_address?.split(",")[0] ?? ""} → ${row.delivery_address?.split(",")[0] ?? ""}`, at: Date.now(), read: false }
  }
  if (role === "driver" && event === "INSERT" && row.status === "requested") {
    return { id: row.id, title: "New Job Available", body: `${tn} — ${row.pickup_address?.split(",")[0] ?? ""} → ${row.delivery_address?.split(",")[0] ?? ""}`, at: Date.now(), read: false }
  }
  if (role === "customer" && event === "UPDATE") {
    const s = row.status as string
    if (s === "accepted") return { id: `${row.id}-accepted`, title: "Driver On the Way", body: `Your delivery ${tn} has been accepted by a driver.`, at: Date.now(), read: false }
    if (s === "collected" || s === "picked_up") return { id: `${row.id}-collected`, title: "Package Picked Up", body: `Driver has collected your package for ${tn}.`, at: Date.now(), read: false }
    if (s === "in_transit") return { id: `${row.id}-transit`, title: "In Transit", body: `Your delivery ${tn} is on its way.`, at: Date.now(), read: false }
    if (s === "delivered") return { id: `${row.id}-delivered`, title: "Delivered!", body: `Your delivery ${tn} has been completed.`, at: Date.now(), read: false }
  }
  return null
}

export function RealtimeNotifications({ role, userId }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [notifs, setNotifs] = useState<Notif[]>([])
  const [open, setOpen] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)

  const unread = notifs.filter((n) => !n.read).length

  useEffect(() => {
    const filter =
      role === "customer"
        ? `customer_id=eq.${userId}`
        : role === "driver"
        ? "status=eq.requested"
        : undefined

    const channel = supabase
      .channel(`notifs-${role}-${userId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "delivery_requests", ...(filter ? { filter } : {}) },
        (payload) => {
          const n = buildNotif(role, payload)
          if (!n) return
          setNotifs((prev) => [n, ...prev].slice(0, 30))
          // Auto-show the bell as unread
          setOpen(false)
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, role, userId])

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
