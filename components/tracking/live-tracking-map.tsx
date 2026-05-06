"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from "react-leaflet"
import L from "leaflet"
import "leaflet/dist/leaflet.css"

export type LatLng = { lat: number; lng: number }

type Props = {
  driver: LatLng | null
  pickup?: LatLng | null
  destination?: LatLng | null
  height?: number | string
  className?: string
  driverLabel?: string
  followDriver?: boolean
}

const DRIVER_ICON = L.divIcon({
  className: "kv-driver-marker",
  html: `
    <div style="
      position: relative;
      width: 38px; height: 38px;
      transform: translate(-19px, -19px);
    ">
      <div style="
        position: absolute; inset: 0;
        background: rgba(163,166,255,0.25);
        border-radius: 9999px;
        animation: kv-pulse 2s ease-out infinite;
      "></div>
      <div style="
        position: absolute; top: 7px; left: 7px;
        width: 24px; height: 24px;
        background: #a3a6ff;
        border: 3px solid #0e0e0e;
        border-radius: 9999px;
        box-shadow: 0 0 12px rgba(163,166,255,0.6);
        display: flex; align-items: center; justify-content: center;
        color: #0f00a4; font-size: 12px;
      ">
        <span class="material-symbols-outlined" style="font-size:14px;font-weight:700">local_shipping</span>
      </div>
    </div>
    <style>
      @keyframes kv-pulse {
        0%   { transform: scale(0.6); opacity: 0.9; }
        100% { transform: scale(1.6); opacity: 0; }
      }
    </style>
  `,
})

const PIN_PICKUP = L.divIcon({
  className: "kv-pin",
  html: `<div style="
    width:18px;height:18px;border-radius:9999px;
    background:#c180ff;border:3px solid #0e0e0e;
    box-shadow:0 0 8px rgba(193,128,255,0.6);
    transform:translate(-9px,-9px);
  "></div>`,
})

const PIN_DEST = L.divIcon({
  className: "kv-pin",
  html: `<div style="
    width:18px;height:18px;border-radius:9999px;
    background:#6ee7b7;border:3px solid #0e0e0e;
    box-shadow:0 0 8px rgba(110,231,183,0.6);
    transform:translate(-9px,-9px);
  "></div>`,
})

function FitBounds({ points }: { points: LatLng[] }) {
  const map = useMap()
  useEffect(() => {
    if (points.length === 0) return
    if (points.length === 1) {
      map.setView([points[0].lat, points[0].lng], 14, { animate: true })
      return
    }
    const bounds = L.latLngBounds(points.map((p) => [p.lat, p.lng]))
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 })
  }, [map, JSON.stringify(points)])
  return null
}

function FollowDriver({ point, enabled }: { point: LatLng | null; enabled: boolean }) {
  const map = useMap()
  useEffect(() => {
    if (!enabled || !point) return
    map.panTo([point.lat, point.lng], { animate: true })
  }, [map, enabled, point?.lat, point?.lng])
  return null
}

export function LiveTrackingMap({
  driver,
  pickup,
  destination,
  height = 400,
  className,
  driverLabel = "Driver",
  followDriver = false,
}: Props) {
  const [mounted, setMounted] = useState(false)
  useEffect(() => { setMounted(true) }, [])

  const fitPoints = useMemo(() => {
    const arr: LatLng[] = []
    if (driver) arr.push(driver)
    if (pickup) arr.push(pickup)
    if (destination) arr.push(destination)
    return arr
  }, [driver, pickup, destination])

  const center: LatLng = driver ?? destination ?? pickup ?? { lat: 24.8607, lng: 67.0011 }

  if (!mounted) {
    return (
      <div
        className={className}
        style={{ height, background: "#0e0e0e", borderRadius: 12 }}
      />
    )
  }

  return (
    <div className={className} style={{ height, position: "relative", borderRadius: 12, overflow: "hidden" }}>
      <MapContainer
        center={[center.lat, center.lng]}
        zoom={13}
        scrollWheelZoom
        style={{ height: "100%", width: "100%", background: "#0e0e0e" }}
      >
        <TileLayer
          attribution='&copy; <a href="https://osm.org/copyright">OpenStreetMap</a>'
          url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
        />

        {pickup && destination && (
          <Polyline
            positions={[
              [pickup.lat, pickup.lng],
              ...(driver ? [[driver.lat, driver.lng] as [number, number]] : []),
              [destination.lat, destination.lng],
            ]}
            pathOptions={{ color: "#a3a6ff", weight: 3, dashArray: "6 8", opacity: 0.7 }}
          />
        )}

        {pickup && (
          <Marker position={[pickup.lat, pickup.lng]} icon={PIN_PICKUP}>
            <Popup>Pickup</Popup>
          </Marker>
        )}
        {destination && (
          <Marker position={[destination.lat, destination.lng]} icon={PIN_DEST}>
            <Popup>Destination</Popup>
          </Marker>
        )}
        {driver && (
          <Marker position={[driver.lat, driver.lng]} icon={DRIVER_ICON}>
            <Popup>{driverLabel}</Popup>
          </Marker>
        )}

        <FitBounds points={fitPoints} />
        <FollowDriver point={driver} enabled={followDriver} />
      </MapContainer>
    </div>
  )
}
