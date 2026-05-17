"use client"

import { useEffect, useRef, useState, useCallback } from "react"
import { GoogleMap, useJsApiLoader, Polyline } from "@react-google-maps/api"

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
  height?: number | string
  followDriverId?: string | null
  customerLocation?: LngLat | null
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase()
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
}

function toLngLat(ll: LngLat) {
  return { lat: ll.lat, lng: ll.lng }
}

export function MapboxLiveMap({
  drivers = [],
  pickup,
  destination,
  routeGeometry,
  height = 400,
  followDriverId,
  customerLocation,
}: Props) {
  const { isLoaded } = useJsApiLoader({ googleMapsApiKey: GOOGLE_KEY })
  const mapRef = useRef<google.maps.Map | null>(null)
  const markersRef = useRef<Map<string, google.maps.marker.AdvancedMarkerElement>>(new Map())
  const [userLocation, setUserLocation] = useState<LngLat | null>(null)

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
  }, [])

  // Fit bounds / fly to whenever markers change
  useEffect(() => {
    const map = mapRef.current
    if (!map || !isLoaded) return

    const points: google.maps.LatLng[] = []
    drivers.forEach((d) => points.push(new google.maps.LatLng(d.position.lat, d.position.lng)))
    if (pickup) points.push(new google.maps.LatLng(pickup.lat, pickup.lng))
    if (destination) points.push(new google.maps.LatLng(destination.lat, destination.lng))
    if (customerLocation) points.push(new google.maps.LatLng(customerLocation.lat, customerLocation.lng))

    if (points.length === 0) {
      if (userLocation) map.panTo({ lat: userLocation.lat, lng: userLocation.lng })
      return
    }
    if (points.length === 1) {
      map.panTo(points[0].toJSON())
      map.setZoom(15)
      return
    }
    const bounds = new google.maps.LatLngBounds()
    points.forEach((p) => bounds.extend(p))
    map.fitBounds(bounds, 80)
  }, [isLoaded, drivers.length, !!pickup, !!destination, !!customerLocation, userLocation])

  // Follow specific driver
  useEffect(() => {
    if (!followDriverId || !mapRef.current) return
    const d = drivers.find((d) => d.id === followDriverId)
    if (d) mapRef.current.panTo({ lat: d.position.lat, lng: d.position.lng })
  }, [drivers, followDriverId])

  // Manage advanced markers
  useEffect(() => {
    if (!isLoaded || !mapRef.current) return
    const map = mapRef.current
    const existing = markersRef.current
    const newKeys = new Set<string>()

    async function ensureLib() {
      return google.maps.importLibrary("marker") as Promise<google.maps.MarkerLibrary>
    }

    async function renderMarkers() {
      const { AdvancedMarkerElement } = await ensureLib()

      function upsert(key: string, lat: number, lng: number, el: HTMLElement) {
        newKeys.add(key)
        if (existing.has(key)) {
          const m = existing.get(key)!
          m.position = { lat, lng }
          if (m.content !== el) m.content = el
        } else {
          const m = new AdvancedMarkerElement({ map, position: { lat, lng }, content: el })
          existing.set(key, m)
        }
      }

      // Pickup
      if (pickup) {
        const el = document.createElement("div")
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:32px;height:32px;border-radius:50%;background:#a3a6ff;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(163,166,255,0.5)">
            <span class="material-symbols-outlined" style="color:white;font-size:16px">radio_button_checked</span>
          </div>
          <div style="width:2px;height:10px;background:#a3a6ff"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#a3a6ff"></div>
        </div>`
        upsert("pickup", pickup.lat, pickup.lng, el)
      }

      // Destination
      if (destination) {
        const el = document.createElement("div")
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center">
          <div style="width:32px;height:32px;border-radius:50%;background:#c180ff;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 12px rgba(193,128,255,0.5)">
            <span class="material-symbols-outlined" style="color:white;font-size:16px">location_on</span>
          </div>
          <div style="width:2px;height:10px;background:#c180ff"></div>
          <div style="width:6px;height:6px;border-radius:50%;background:#c180ff"></div>
        </div>`
        upsert("destination", destination.lat, destination.lng, el)
      }

      // Customer
      if (customerLocation) {
        const el = document.createElement("div")
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;position:relative">
          <div style="position:absolute;inset:0;border-radius:50%;background:rgba(6,182,212,0.3);transform:scale(1.8);animation:ping 1s cubic-bezier(0,0,0.2,1) infinite"></div>
          <div style="width:36px;height:36px;border-radius:50%;background:#06b6d4;border:2px solid white;display:flex;align-items:center;justify-content:center;box-shadow:0 0 14px rgba(6,182,212,0.6);position:relative;z-index:1">
            <span class="material-symbols-outlined" style="color:white;font-size:16px">person_pin</span>
          </div>
          <div style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:#06b6d4;color:white;margin-top:2px;white-space:nowrap">Customer</div>
        </div>`
        upsert("customer", customerLocation.lat, customerLocation.lng, el)
      }

      // Drivers
      for (const driver of drivers) {
        const el = document.createElement("div")
        const accepted = driver.isAccepted
        el.innerHTML = `<div style="display:flex;flex-direction:column;align-items:center;position:relative">
          ${accepted ? `<div style="position:absolute;inset:0;border-radius:50%;background:rgba(74,222,128,0.3);transform:scale(1.8);animation:ping 1s cubic-bezier(0,0,0.2,1) infinite"></div>` : ''}
          <div style="width:40px;height:40px;border-radius:50%;border:2px solid ${accepted ? '#86efac' : 'white'};background:${accepted ? '#22c55e' : '#a3a6ff'};display:flex;align-items:center;justify-content:center;font-size:12px;font-weight:900;color:${accepted ? 'white' : '#0f00a4'};box-shadow:0 0 14px ${accepted ? 'rgba(34,197,94,0.5)' : 'rgba(163,166,255,0.4)'};position:relative;z-index:1">
            ${initials(driver.label)}
          </div>
          <div style="font-size:9px;font-weight:700;padding:2px 6px;border-radius:4px;background:${accepted ? '#22c55e' : '#1a1919'};color:${accepted ? 'white' : '#adaaaa'};margin-top:2px;white-space:nowrap">${driver.label}</div>
        </div>`
        upsert(`driver-${driver.id}`, driver.position.lat, driver.position.lng, el)
      }

      // Remove stale markers
      for (const [key, marker] of existing) {
        if (!newKeys.has(key)) {
          marker.map = null
          existing.delete(key)
        }
      }
    }

    renderMarkers()
  }, [isLoaded, pickup, destination, customerLocation, drivers])

  // Cleanup markers on unmount
  useEffect(() => {
    return () => {
      markersRef.current.forEach((m) => { m.map = null })
      markersRef.current.clear()
    }
  }, [])

  const routeCoords = routeGeometry
    ? routeGeometry.coordinates.map(([lng, lat]) => ({ lat, lng }))
    : null

  const defaultCenter = userLocation
    ? { lat: userLocation.lat, lng: userLocation.lng }
    : { lat: 33.1, lng: 73.75 } // Mirpur, AJK default

  if (!isLoaded) {
    return <div style={{ height }} className="bg-[#1a1a1a] rounded-xl animate-pulse" />
  }

  return (
    <div style={{ height }} className="relative rounded-xl overflow-hidden">
      <style>{`@keyframes ping{75%,100%{transform:scale(2);opacity:0}}`}</style>
      <GoogleMap
        mapContainerStyle={{ width: "100%", height: "100%" }}
        center={defaultCenter}
        zoom={14}
        onLoad={onMapLoad}
        options={{
          styles: DARK_STYLES,
          disableDefaultUI: true,
          zoomControl: true,
          zoomControlOptions: { position: 9 /* BOTTOM_RIGHT */ },
          mapId: undefined,
          clickableIcons: false,
        }}
      >
        {routeCoords && routeCoords.length > 1 && (
          <Polyline
            path={routeCoords}
            options={{ strokeColor: "#a3a6ff", strokeWeight: 4, strokeOpacity: 0.85 }}
          />
        )}
      </GoogleMap>
    </div>
  )
}
