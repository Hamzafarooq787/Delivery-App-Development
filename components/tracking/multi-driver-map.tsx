"use client"

import { useEffect, useMemo, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"
import { createClient } from "@/lib/supabase/client"

export type DriverPin = {
  driver_id: string
  name: string
  delivery_id: string | null
  tracking_number: string | null
  status: string
  lat: number
  lng: number
  updated_at: string
}

type Props = {
  /** Active deliveries for this customer */
  deliveries: {
    id: string
    tracking_number: string | null
    status: string
    driver_id: string | null
    driver_name: string | null
  }[]
  height?: number | string
  className?: string
}

function makeDriverIcon(initials: string) {
  return L.divIcon({
    className: "kv-driver-marker",
    iconAnchor: [19, 19],
    html: `
      <div style="position:relative;width:38px;height:38px;">
        <div style="
          position:absolute;inset:0;
          background:rgba(var(--brand-rgb),0.2);
          border-radius:9999px;
          animation:kv-pulse 2s ease-out infinite;
        "></div>
        <div style="
          position:absolute;top:4px;left:4px;
          width:30px;height:30px;
          background:var(--color-primary);
          border:2.5px solid #0e0e0e;
          border-radius:9999px;
          box-shadow:0 0 12px rgba(var(--brand-rgb),0.6);
          display:flex;align-items:center;justify-content:center;
          color:var(--color-on-primary);font-size:11px;font-weight:800;font-family:system-ui;
        ">${initials}</div>
      </div>
      <style>
        @keyframes kv-pulse{0%{transform:scale(0.6);opacity:0.9;}100%{transform:scale(1.8);opacity:0;}}
      </style>
    `,
  })
}

function FitAll({ pins }: { pins: DriverPin[] }) {
  const map = useMap()
  useEffect(() => {
    if (pins.length === 0) return
    if (pins.length === 1) {
      map.setView([pins[0].lat, pins[0].lng], 14, { animate: true })
      return
    }
    const bounds = L.latLngBounds(pins.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [map, pins.map((p) => `${p.driver_id}:${p.lat}:${p.lng}`).join("|")])
  return null
}

function getInitials(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function AgeBadge({ updatedAt }: { updatedAt: string }) {
  const [label, setLabel] = useState("")
  useEffect(() => {
    const tick = () => {
      const sec = Math.max(0, (Date.now() - new Date(updatedAt).getTime()) / 1000)
      if (sec < 5) setLabel("just now")
      else if (sec < 60) setLabel(`${Math.round(sec)}s ago`)
      else setLabel(`${Math.round(sec / 60)}m ago`)
    }
    tick()
    const id = setInterval(tick, 5000)
    return () => clearInterval(id)
  }, [updatedAt])
  return <>{label}</>
}

export function MultiDriverMap({ deliveries, height = 400, className }: Props) {
  const supabase = useMemo(() => createClient(), [])
  const [pins, setPins] = useState<Map<string, DriverPin>>(new Map())
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Build a lookup: driver_id → delivery info
  const driverMeta = useMemo(() => {
    const m = new Map<string, { delivery_id: string; tracking_number: string | null; status: string; name: string }>()
    for (const d of deliveries) {
      if (d.driver_id) {
        m.set(d.driver_id, {
          delivery_id: d.id,
          tracking_number: d.tracking_number,
          status: d.status,
          name: d.driver_name ?? "Driver",
        })
      }
    }
    return m
  }, [deliveries])

  const driverIds = useMemo(() => [...driverMeta.keys()], [driverMeta])

  // Fetch initial locations
  useEffect(() => {
    if (driverIds.length === 0) { setPins(new Map()); return }

    let cancelled = false
    supabase
      .from("driver_locations")
      .select("driver_id, lat, lng, updated_at, delivery_id")
      .in("driver_id", driverIds)
      .then(({ data }) => {
        if (cancelled || !data) return
        setPins((prev) => {
          const next = new Map(prev)
          for (const row of data) {
            const meta = driverMeta.get(row.driver_id)
            if (!meta) continue
            next.set(row.driver_id, {
              driver_id: row.driver_id,
              name: meta.name,
              delivery_id: meta.delivery_id,
              tracking_number: meta.tracking_number,
              status: meta.status,
              lat: Number(row.lat),
              lng: Number(row.lng),
              updated_at: row.updated_at as string,
            })
          }
          return next
        })
      })

    return () => { cancelled = true }
  }, [supabase, driverIds.join(",")])

  // Subscribe to realtime changes
  useEffect(() => {
    if (driverIds.length === 0) return

    const channel = supabase
      .channel("multi-driver-locations")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "driver_locations" },
        (payload) => {
          const row = payload.new as { driver_id: string; lat: number; lng: number; updated_at: string } | null
          if (!row?.driver_id) return
          const meta = driverMeta.get(row.driver_id)
          if (!meta) return
          setPins((prev) => {
            const next = new Map(prev)
            next.set(row.driver_id, {
              driver_id: row.driver_id,
              name: meta.name,
              delivery_id: meta.delivery_id,
              tracking_number: meta.tracking_number,
              status: meta.status,
              lat: Number(row.lat),
              lng: Number(row.lng),
              updated_at: row.updated_at,
            })
            return next
          })
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [supabase, driverIds.join(","), driverMeta])

  const pinList = useMemo(() => [...pins.values()], [pins])
  const center = pinList[0] ?? { lat: 24.8607, lng: 67.0011 }

  if (!mounted) {
    return <div style={{ height, borderRadius: 12, background: "#0e0e0e" }} className={className} />
  }

  return (
    <div style={{ height, borderRadius: 12, overflow: "hidden", position: "relative" }} className={className}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />
        {pinList.map((pin) => (
          <Marker
            key={pin.driver_id}
            position={[pin.lat, pin.lng]}
            icon={makeDriverIcon(getInitials(pin.name))}
          >
            <Popup>
              <div style={{ minWidth: 140 }}>
                <p style={{ fontWeight: 800, marginBottom: 4 }}>{pin.name}</p>
                {pin.tracking_number && (
                  <p style={{ fontSize: 11, color: "#888" }}>{pin.tracking_number}</p>
                )}
                <p style={{ fontSize: 11, color: "#888", marginTop: 2 }}>
                  Updated: <AgeBadge updatedAt={pin.updated_at} />
                </p>
              </div>
            </Popup>
          </Marker>
        ))}
        <FitAll pins={pinList} />
      </MapContainer>

      {/* Live badge */}
      <div style={{
        position: "absolute", top: 10, left: 10, zIndex: 400,
        display: "flex", alignItems: "center", gap: 6,
        padding: "4px 10px", borderRadius: 999,
        background: "rgba(14,14,14,0.85)", border: "1px solid rgba(73,72,71,0.3)",
        backdropFilter: "blur(8px)",
        fontSize: 10, fontWeight: 700, color: "#fff", textTransform: "uppercase", letterSpacing: "0.1em",
      }}>
        <span style={{
          width: 7, height: 7, borderRadius: "50%",
          background: pinList.length > 0 ? "#4ade80" : "#494847",
          boxShadow: pinList.length > 0 ? "0 0 6px #4ade80" : "none",
          animation: pinList.length > 0 ? "kv-blink 1.5s ease-in-out infinite" : "none",
        }} />
        {pinList.length > 0 ? `${pinList.length} driver${pinList.length > 1 ? "s" : ""} live` : "No drivers active"}
      </div>
      <style>{`@keyframes kv-blink{0%,100%{opacity:1}50%{opacity:0.4}}`}</style>
    </div>
  )
}

export { AgeBadge }
export type { DriverPin as DriverPinType }

