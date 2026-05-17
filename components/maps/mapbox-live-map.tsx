"use client"

import { useEffect, useRef, useState } from "react"
import Map, { Marker, Source, Layer, NavigationControl, type MapRef } from "react-map-gl/mapbox"

const MAPBOX_TOKEN = process.env.NEXT_PUBLIC_MAPBOX_TOKEN!
const DARK_STYLE = "mapbox://styles/mapbox/dark-v11"

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
  const [userLocation, setUserLocation] = useState<LngLat | null>(null)

  useEffect(() => {
    setMounted(true)
    // Get user location to center map initially
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
        () => {} // silent fail — fall back to default
      )
    }
  }, [])

  // Pan to followed driver
  useEffect(() => {
    if (!followDriverId || !mapRef.current) return
    const d = drivers.find((d) => d.id === followDriverId)
    if (d) mapRef.current.easeTo({ center: [d.position.lng, d.position.lat], duration: 800 })
  }, [drivers, followDriverId])

  // Fit bounds / zoom to markers whenever they change
  useEffect(() => {
    if (!mapRef.current || !mounted) return
    const points: [number, number][] = []
    drivers.forEach((d) => points.push([d.position.lng, d.position.lat]))
    if (pickup) points.push([pickup.lng, pickup.lat])
    if (destination) points.push([destination.lng, destination.lat])

    if (points.length === 0) return

    if (points.length === 1) {
      // Single marker — zoom to street level
      mapRef.current.flyTo({ center: points[0], zoom: 14, duration: 1000 })
      return
    }

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

  // Default center: user location if available, else London as neutral fallback
  const defaultCenter = userLocation ?? { lng: -0.1276, lat: 51.5074 }

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden">
      <Map
        ref={mapRef}
        mapboxAccessToken={MAPBOX_TOKEN}
        mapStyle={DARK_STYLE}
        initialViewState={{ longitude: defaultCenter.lng, latitude: defaultCenter.lat, zoom: 12 }}
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
              paint={{ "line-color": "#a3a6ff", "line-width": 4, "line-opacity": 0.85 }}
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
              {driver.isAccepted && (
                <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping scale-150" />
              )}
              <div className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black shadow-xl z-10 ${
                driver.isAccepted
                  ? "bg-green-500 border-green-300 text-white shadow-green-500/40"
                  : "bg-[#a3a6ff] border-white text-[#0f00a4] shadow-[#a3a6ff]/40"
              }`}>
                {initials(driver.label)}
              </div>
              <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap ${
                driver.isAccepted ? "bg-green-500 text-white" : "bg-[#1a1919] text-[#adaaaa]"
              }`}>
                {driver.label}
              </div>
            </div>
          </Marker>
        ))}
      </Map>
    </div>
  )
}
