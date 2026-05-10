"use client"

import { useEffect, useRef, useState } from "react"
import Map, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl/mapbox"
import { MAPBOX_TOKEN, DARK_STYLE } from "@/lib/mapbox"

type LngLat = { lng: number; lat: number }

type Driver = {
  id: string
  label: string
  position: LngLat
  isAccepted?: boolean
}

type Props = {
  drivers?: Driver[]
  pickup?: LngLat | null
  destination?: LngLat | null
  routeGeometry?: GeoJSON.LineString | null
  height?: number | string
  followDriverId?: string | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

export function MapboxLiveMap({
  drivers = [],
  pickup,
  destination,
  routeGeometry,
  height = 400,
  followDriverId,
}: Props) {
  const mapRef = useRef<MapRef>(null)
  const [mounted, setMounted] = useState(false)

  useEffect(() => { setMounted(true) }, [])

  // Pan to followed driver when position changes
  useEffect(() => {
    if (!followDriverId || !mapRef.current) return
    const d = drivers.find((d) => d.id === followDriverId)
    if (d) {
      mapRef.current.easeTo({ center: [d.position.lng, d.position.lat], duration: 800 })
    }
  }, [drivers, followDriverId])

  // Fit bounds to show all markers
  useEffect(() => {
    if (!mapRef.current || !mounted) return
    const points: [number, number][] = []
    drivers.forEach((d) => points.push([d.position.lng, d.position.lat]))
    if (pickup) points.push([pickup.lng, pickup.lat])
    if (destination) points.push([destination.lng, destination.lat])
    if (points.length < 2) return
    const lngs = points.map((p) => p[0])
    const lats = points.map((p) => p[1])
    mapRef.current.fitBounds(
      [[Math.min(...lngs), Math.min(...lats)], [Math.max(...lngs), Math.max(...lats)]],
      { padding: 80, duration: 1000, maxZoom: 15 }
    )
  }, [mounted, drivers.length, !!pickup, !!destination])

  if (!mounted) return <div style={{ height }} className="bg-[#1a1a1a] rounded-xl animate-pulse" />

  const routeData: GeoJSON.Feature<GeoJSON.LineString> | null = routeGeometry
    ? { type: "Feature", properties: {}, geometry: routeGeometry }
    : null

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: 0, latitude: 20, zoom: 2 }}
        style={{ width: "100%", height: "100%" }}
        attributionControl={false}
      >
        <NavigationControl position="bottom-right" />

        {/* Route line */}
        {routeData && (
          <Source id="route" type="geojson" data={routeData}>
            <Layer
              id="route-line"
              type="line"
              paint={{
                "line-color": "#a3a6ff",
                "line-width": 4,
                "line-opacity": 0.85,
              }}
              layout={{ "line-join": "round", "line-cap": "round" }}
            />
          </Source>
        )}

        {/* Pickup marker */}
        {pickup && (
          <Marker longitude={pickup.lng} latitude={pickup.lat} anchor="bottom">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#a3a6ff] border-2 border-white flex items-center justify-center shadow-lg shadow-[#a3a6ff]/40">
                <span className="material-symbols-outlined text-white text-sm">radio_button_checked</span>
              </div>
              <div className="w-0.5 h-3 bg-[#a3a6ff]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#a3a6ff]" />
            </div>
          </Marker>
        )}

        {/* Destination marker */}
        {destination && (
          <Marker longitude={destination.lng} latitude={destination.lat} anchor="bottom">
            <div className="flex flex-col items-center">
              <div className="w-8 h-8 rounded-full bg-[#c180ff] border-2 border-white flex items-center justify-center shadow-lg shadow-[#c180ff]/40">
                <span className="material-symbols-outlined text-white text-sm">location_on</span>
              </div>
              <div className="w-0.5 h-3 bg-[#c180ff]" />
              <div className="w-1.5 h-1.5 rounded-full bg-[#c180ff]" />
            </div>
          </Marker>
        )}

        {/* Driver markers */}
        {drivers.map((driver) => (
          <Marker key={driver.id} longitude={driver.position.lng} latitude={driver.position.lat} anchor="center">
            <div className="relative flex flex-col items-center">
              {/* Pulsing ring for accepted driver */}
              {driver.isAccepted && (
                <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping scale-150" />
              )}
              <div
                className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-xl z-10 ${
                  driver.isAccepted
                    ? "bg-green-500 border-green-300 text-white shadow-green-500/40"
                    : "bg-[#a3a6ff] border-white text-[#0f00a4] shadow-[#a3a6ff]/40"
                }`}
              >
                {initials(driver.label)}
              </div>
              <div
                className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap ${
                  driver.isAccepted ? "bg-green-500 text-white" : "bg-[#1a1919] text-[#adaaaa]"
                }`}
              >
                {driver.label}
              </div>
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  )
}
