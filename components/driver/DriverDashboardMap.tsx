'use client'

import { useCallback, useEffect, useRef } from 'react'
import {
  GoogleMap,
  Marker,
  OverlayView,
  Polyline,
  useJsApiLoader,
} from '@react-google-maps/api'
import { useBrand } from '@/components/shared/brand-provider'
import styles from './MapFirstDashboard.module.css'

export type MapPoint = { lat: number; lng: number }
export type DashboardRoute = {
  pickup: MapPoint
  dropoff: MapPoint
  path: MapPoint[]
  miles: number
  minutes: number
}
const center = { lat: 53.4808, lng: -2.2426 }
const darkMap: google.maps.MapTypeStyle[] = [
  { elementType: 'geometry', stylers: [{ color: '#22272c' }] },
  { elementType: 'labels.text.fill', stylers: [{ color: '#abb4bf' }] },
  { elementType: 'labels.text.stroke', stylers: [{ color: '#22272c' }] },
  {
    featureType: 'road',
    elementType: 'geometry',
    stylers: [{ color: '#343c44' }],
  },
  {
    featureType: 'road.highway',
    elementType: 'geometry',
    stylers: [{ color: '#48505a' }],
  },
  {
    featureType: 'water',
    elementType: 'geometry',
    stylers: [{ color: '#172027' }],
  },
  { featureType: 'poi', stylers: [{ visibility: 'off' }] },
  { featureType: 'transit', stylers: [{ visibility: 'off' }] },
]

export default function DriverDashboardMap({
  route,
  location,
  recenter,
}: {
  route: DashboardRoute | null
  location: MapPoint | null
  recenter: number
}) {
  const key = process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY
  // The configured loader is only mounted when a key exists.
  return key ? (
    <LoadedMap
      apiKey={key}
      route={route}
      location={location}
      recenter={recenter}
    />
  ) : (
    <div className={styles.mapMessage}>
      <strong>Map unavailable</strong>
      <span>Job details and booking controls are still available.</span>
    </div>
  )
}

function LoadedMap({
  apiKey,
  route,
  location,
  recenter,
}: {
  apiKey: string
  route: DashboardRoute | null
  location: MapPoint | null
  recenter: number
}) {
  const { isLoaded, loadError } = useJsApiLoader({
    id: 'google-map-script',
    googleMapsApiKey: apiKey,
  })
  const { brand } = useBrand()
  const color = brand === 'orange' ? '#ff7900' : '#7957ff'
  const map = useRef<google.maps.Map | null>(null)
  const latestLocation = useRef(location)
  useEffect(() => {
    latestLocation.current = location
  }, [location])
  const fit = useCallback(
    (instance: google.maps.Map) => {
      if (route) {
        const bounds = new google.maps.LatLngBounds()
        route.path.forEach((p) => bounds.extend(p))
        bounds.extend(route.pickup)
        bounds.extend(route.dropoff)
        instance.fitBounds(bounds, {
          top: 130,
          right: 45,
          bottom: 55,
          left: 45,
        })
      } else if (latestLocation.current) {
        instance.setCenter(latestLocation.current)
        instance.setZoom(14)
      }
    },
    [route],
  )
  useEffect(() => {
    if (map.current) fit(map.current)
  }, [fit])
  useEffect(() => {
    if (map.current && location && !route) map.current.panTo(location)
  }, [location, route])
  useEffect(() => {
    if (map.current && location && recenter > 0) {
      map.current.panTo(location)
      map.current.setZoom(15)
    }
  }, [recenter, location])
  if (loadError)
    return (
      <div className={styles.mapMessage}>
        <strong>Map could not load</strong>
        <span>You can still review and accept a job below.</span>
      </div>
    )
  if (!isLoaded)
    return (
      <div className={styles.mapMessage} role="status">
        Loading map…
      </div>
    )
  return (
    <GoogleMap
      mapContainerStyle={{ width: '100%', height: '100%' }}
      center={center}
      zoom={12}
      onLoad={(instance) => {
        map.current = instance
        fit(instance)
      }}
      onUnmount={() => {
        map.current = null
      }}
      options={{
        styles: darkMap,
        disableDefaultUI: true,
        zoomControl: true,
        clickableIcons: false,
        gestureHandling: 'greedy',
        backgroundColor: '#22272c',
      }}
    >
      {route && (
        <>
          <Polyline
            path={route.path}
            options={{ strokeColor: color, strokeWeight: 5, strokeOpacity: 1 }}
          />
          {(
            [
              ['Pickup', route.pickup],
              ['Dropoff', route.dropoff],
            ] as const
          ).map(([label, position]) => (
            <OverlayView
              key={label}
              position={position}
              mapPaneName={OverlayView.OVERLAY_MOUSE_TARGET}
            >
              <div
                style={{
                  transform: 'translate(-50%,-100%)',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  color: 'white',
                  fontSize: 11,
                  whiteSpace: 'nowrap',
                }}
              >
                <span
                  style={{
                    width: 20,
                    height: 20,
                    borderRadius: '50%',
                    background: color,
                    border: '3px solid white',
                    display: 'block',
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    background: '#1b1d20',
                    padding: '5px 8px',
                    border: '1px solid #44484f',
                    borderRadius: 6,
                  }}
                >
                  {label}
                </span>
              </div>
            </OverlayView>
          ))}
        </>
      )}
      {location && (
        <Marker
          position={location}
          title="Your current location"
          icon={{
            path: google.maps.SymbolPath.CIRCLE,
            scale: 8,
            fillColor: '#60a5fa',
            fillOpacity: 1,
            strokeColor: '#ffffff',
            strokeWeight: 3,
          }}
        />
      )}
    </GoogleMap>
  )
}
