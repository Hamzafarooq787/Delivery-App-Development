'use client'
import { useEffect, useRef, useState } from 'react'
import { GoogleMap, MarkerF, Polyline, useJsApiLoader } from '@react-google-maps/api'
import { fetchRoute, type LngLat, type RouteResult } from '@/lib/google'
import { useBrand } from '@/components/shared/brand-provider'
import styles from './DeliverySteps.module.css'

const dark: google.maps.MapTypeStyle[] = [
  {elementType:'geometry',stylers:[{color:'#202d39'}]},
  {elementType:'labels.text.fill',stylers:[{color:'#bbc5cf'}]},
  {elementType:'labels.text.stroke',stylers:[{color:'#202d39'}]},
  {featureType:'road',elementType:'geometry',stylers:[{color:'#3c4c5e'}]},
  {featureType:'water',elementType:'geometry',stylers:[{color:'#142330'}]},
  {featureType:'poi',stylers:[{visibility:'off'}]},
]
export default function BookingRouteMap({pickup,destination,userLocation}:{pickup:LngLat|null;destination:LngLat|null;userLocation:LngLat|null}) {
  const {isLoaded,loadError}=useJsApiLoader({id:'google-map-script',googleMapsApiKey:process.env.NEXT_PUBLIC_GOOGLE_MAPS_KEY??''})
  const {brand}=useBrand()
  const [route,setRoute]=useState<RouteResult|null>(null)
  const [routeError,setRouteError]=useState(false)
  const [loading,setLoading]=useState(false)
  const [expanded,setExpanded]=useState(false)
  const dialog=useRef<HTMLDialogElement>(null)
  const expandButton=useRef<HTMLButtonElement>(null)
  const [map,setMap]=useState<google.maps.Map|null>(null)
  useEffect(()=>{
    let active=true
    setRoute(null);setRouteError(false)
    if(!pickup||!destination){setLoading(false);return}
    setLoading(true)
    const timer=setTimeout(()=>{void fetchRoute(pickup,destination).then(value=>{
      if(!active)return
      setRoute(value);setRouteError(!value);setLoading(false)
    })},500)
    return()=>{active=false;clearTimeout(timer)}
  },[pickup?.lat,pickup?.lng,destination?.lat,destination?.lng])
  useEffect(()=>{
    if(!map||!isLoaded)return
    const bounds=new google.maps.LatLngBounds()
    const points=route?.geometry.coordinates.map(([lng,lat])=>({lng,lat}))??[pickup,destination].filter((p):p is LngLat=>!!p)
    if(!points.length){map.setCenter(userLocation??{lat:53.4808,lng:-2.2426});map.setZoom(12);return}
    points.forEach(p=>bounds.extend(p));map.fitBounds(bounds,30)
    if(points.length===1)map.setZoom(14)
  },[map,isLoaded,route,pickup,destination,userLocation,expanded])
  useEffect(()=>{if(expanded)dialog.current?.showModal()},[expanded])
  const close=()=>{setExpanded(false);requestAnimationFrame(()=>expandButton.current?.focus())}
  const content=()=>!isLoaded?<p className={styles.mapStatus} role="status">{loadError?'Map could not load. Your addresses are still available.':'Loading map…'}</p>:<GoogleMap
    mapContainerStyle={{height:'100%',width:'100%'}} onLoad={setMap} onUnmount={()=>setMap(null)}
    options={{styles:dark,disableDefaultUI:true,zoomControl:expanded,gestureHandling:'cooperative',keyboardShortcuts:expanded}}
  >
    {pickup&&<MarkerF position={pickup} label="P" title="Pickup"/>}
    {destination&&<MarkerF position={destination} label="D" title="Delivery"/>}
    {userLocation&&<MarkerF position={userLocation} title="Your current location" icon={{path:google.maps.SymbolPath.CIRCLE,scale:6,fillColor:'#348cff',fillOpacity:1,strokeColor:'#fff',strokeWeight:2}}/>}
    {route&&<Polyline path={route.geometry.coordinates.map(([lng,lat])=>({lng,lat}))} options={{strokeColor:brand==='orange'?'#ff7900':'#7957ff',strokeWeight:5}}/>}
  </GoogleMap>
  return <div className={styles.mapCard}>
    <div className={styles.mapHeader}><strong>Route preview</strong><button ref={expandButton} type="button" onClick={()=>setExpanded(true)}>Expand map ↗</button></div>
    <div className={styles.mapCanvas}>{!expanded&&content()}</div>
    <p className={styles.mapMeta} role="status">{loading?'Calculating route…':routeError?'Route unavailable. Please check your addresses.':route?`${route.distance_miles.toFixed(1)} miles · Estimated journey ${route.duration_min} min`:'Choose pickup and delivery to preview your route.'}</p>
    {expanded&&<dialog ref={dialog} className={styles.mapDialog} onCancel={e=>{e.preventDefault();close()}} onKeyDown={e=>e.stopPropagation()}>
      <div className={styles.mapHeader}><strong>Route preview</strong><button autoFocus type="button" onClick={close}>Close map ×</button></div>
      <div style={{height:'min(70dvh,650px)'}}>{content()}</div>
    </dialog>}
  </div>
}
