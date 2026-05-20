"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { GoogleMap, useJsApiLoader, Polyline, OverlayView } from "@react-google-maps/api"

const GOOGLE_KEY = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY!

const DARK_STYLES: google.maps.MapTypeStyle[] = [
  { elementType: "geometry", stylers: [{ color: "#212121" }] },
  { elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { elementType: "labels.text.stroke", stylers: [{ color: "#212121" }] },
  { featureType: "administrative.locality", elementType: "labels.text.fill", stylers: [{ color: "#bdbdbd" }] },
  { featureType: "poi", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "poi.park", elementType: "geometry", stylers: [{ color: "#181818" }] },
  { featureType: "poi.park", elementType: "labels.text.fill", stylers: [{ color: "#616161" }] },
  { featureType: "road", elementType: "geometry.fill", stylers: [{ color: "#2c2c2c" }] },
  { featureType: "road", elementType: "labels.text.fill", stylers: [{ color: "#8a8a8a" }] },
  { featureType: "road.arterial", elementType: "geometry", stylers: [{ color: "#373737" }] },
  { featureType: "road.highway", elementType: "geometry", stylers: [{ color: "#3c3c3c" }] },
  { featureType: "transit", elementType: "labels.text.fill", stylers: [{ color: "#757575" }] },
  { featureType: "water", elementType: "geometry", stylers: [{ color: "#000000" }] },
  { featureType: "water", elementType: "labels.text.fill", stylers: [{ color: "#3d3d3d" }] },
]

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
  routeGeometry2?: GeoJSON.LineString | null  // driver to pickup segment (different color)
  height?: number | string
  followDriverId?: string | null
  customerLocation?: LngLat | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function PickupPin() {
  return (
    <div style={{ transform: "translate(-50%, -100%)" }} className="flex flex-col items-center">
      <div className="w-8 h-8 rounded-full bg-[#a3a6ff] border-2 border-white flex items-center justify-center shadow-lg" style={{ boxShadow: "0 0 12px rgba(163,166,255,0.6)" }}>
        <span className="material-symbols-outlined text-white text-sm">radio_button_checked</span>
      </div>
      <div className="w-0.5 h-2.5 bg-[#a3a6ff]" />
      <div className="w-1.5 h-1.5 rounded-full bg-[#a3a6ff]" />
    </div>
  )
}

function DestinationPin() {
  return (
    <div style={{ transform: "translate(-50%, -100%)" }} className="flex flex-col items-center">
      <div className="w-8 h-8 rounded-full bg-[#c180ff] border-2 border-white flex items-center justify-center shadow-lg" style={{ boxShadow: "0 0 12px rgba(193,128,255,0.6)" }}>
        <span className="material-symbols-outlined text-white text-sm">location_on</span>
      </div>
      <div className="w-0.5 h-2.5 bg-[#c180ff]" />
      <div className="w-1.5 h-1.5 rounded-full bg-[#c180ff]" />
    </div>
  )
}

function CustomerPin() {
  return (
    <div style={{ transform: "translate(-50%, -50%)" }} className="flex flex-col items-center relative">
      <div className="absolute inset-0 rounded-full bg-cyan-400/30 animate-ping" style={{ transform: "scale(2)" }} />
      <div className="w-9 h-9 rounded-full bg-cyan-500 border-2 border-white flex items-center justify-center z-10 relative" style={{ boxShadow: "0 0 14px rgba(6,182,212,0.6)" }}>
        <span className="material-symbols-outlined text-white text-sm">person_pin</span>
      </div>
      <div className="text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 bg-cyan-500 text-white whitespace-nowrap">Customer</div>
    </div>
  )
}

function DriverPin({ driver }: { driver: Driver }) {
  const accepted = driver.isAccepted
  return (
    <div style={{ transform: "translate(-50%, -50%)" }} className="flex flex-col items-center relative">
      {accepted && <div className="absolute inset-0 rounded-full bg-green-400/30 animate-ping" style={{ transform: "scale(2)" }} />}
      <div
        className={`w-10 h-10 rounded-full border-2 flex items-center justify-center text-xs font-black z-10 relative ${
          accepted ? "bg-green-500 border-green-300 text-white" : "bg-[#a3a6ff] border-white text-[#0f00a4]"
        }`}
        style={{ boxShadow: accepted ? "0 0 14px rgba(34,197,94,0.5)" : "0 0 14px rgba(163,166,255,0.4)" }}
      >
        {initials(driver.label)}
      </div>
      <div className={`text-[9px] font-bold px-1.5 py-0.5 rounded mt-0.5 whitespace-nowrap ${accepted ? "bg-green-500 text-white" : "bg-[#1a1919] text-[#adaaaa]"}`}>
        {driver.label}
      </div>
    </div>
  )
}

export function MapboxLiveMap({
  drivers = [],
  pickup,
  destination,
  routeGeometry,
  routeGeometry2,
  height = 400,
  followDriverId,
  customerLocation,
}: Props) {
  const { isLoaded } = useJsApiLoader({ id: "google-map-script", googleMapsApiKey: GOOGLE_KEY })
  const mapRef = useRef<google.maps.Map | null>(null)
  const [userLocation, setUserLocation] = useState<LngLat | null>(null)
  const [mapReady, setMapReady] = useState(false)

  useEffect(() => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (pos) => setUserLocation({ lng: pos.coords.longitude, lat: pos.coords.latitude }),
        () => {}
      )
    }
  }, [])

  const onMapLoad = useCallback((map: google.maps.Map) => {
    mapRef.current = map
    setMapReady(true)
  }, [])

  // Fit bounds whenever markers change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return

    const points: { lat: number; lng: number }[] = []
    drivers.forEach((d) => points.push({ lat: d.position.lat, lng: d.position.lng }))
    if (pickup) points.push({ lat: pickup.lat, lng: pickup.lng })
    if (destination) points.push({ lat: destination.lat, lng: destination.lng })
    if (customerLocation) points.push({ lat: customerLocation.lat, lng: customerLocation.lng })

    if (points.length === 0) {
      if (userLocation) map.panTo({ lat: userLocation.lat, lng: userLocation.lng })
      return
    }
    if (points.length === 1) {
      map.panTo(points[0])
      map.setZoom(14)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 80)
  }, [mapReady, drivers.length, !!pickup, !!destination, !!customerLocation, userLocation])

  // Follow specific driver
  useEffect(() => {
    if (!followDriverId || !mapRef.current) return
    const d = drivers.find((d) => d.id === followDriverId)
    if (d) mapRef.current.panTo({ lat: d.position.lat, lng: d.position.lng })
  }, [drivers, followDriverId])

  const routeCoords = routeGeometry
    ? routeGeometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
    : null

  const routeCoords2 = routeGeometry2
    ? routeGeometry2.coordinates.map(([lng, lat]) => ({ lat, lng }))
    : null

  const defaultCenter = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 33.1, lng: 73.75 } // Mirpur, AJK

  if (!isLoaded) {
    return <div style={{ height }} className="bg-[#1a1a1a] rounded-xl animate-pulse" />
  }

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden">
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={defaultCenter}
        zoom={11}
        onLoad={onMapLoad}
        options={{
          styles: DARK_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: 9 /* BOTTOM_RIGHT */ },
          clickableIcons: false,
          gestureHandling: "greedy",
        }}
      >
        {routeCoords && routeCoords.length > 1 && (
          <Polyline
            path={routeCoords}
            options={{ strokeColor: "#a3a6ff", strokeWeight: 4, strokeOpacity: 0.85 }}
          />
        )}

        {routeCoords2 && routeCoords2.length > 1 && (
          <Polyline
            path={routeCoords2}
            options={{ strokeColor: "#c180ff", strokeWeight: 3, strokeOpacity: 0.7, strokeDasharray: "8 6" }}
          />
        )}

        {pickup && (
          <OverlayView position={{ lat: pickup.lat, lng: pickup.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <PickupPin />
          </OverlayView>
        )}

        {destination && (
          <OverlayView position={{ lat: destination.lat, lng: destination.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <DestinationPin />
          </OverlayView>
        )}

        {customerLocation && (
          <OverlayView position={{ lat: customerLocation.lat, lng: customerLocation.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <CustomerPin />
          </OverlayView>
        )}

        {drivers.map((driver) => (
          <OverlayView key={driver.id} position={{ lat: driver.position.lat, lng: driver.position.lng }} mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}>
            <DriverPin driver={driver} />
          </OverlayView>
        ))}
      </GoogleMap>
    </div>
  )
}
