'use client'
import {useEffect,useRef,useState} from 'react'
import { updateCustomerLocation,clearCustomerLocation } from '@/app/actions/tracking'
type Props={orderLabel?:string;deliveryId?:string|null;disabled?:boolean;intervalMs?:number}
export function CustomerLocationBroadcaster({deliveryId=null,disabled=false,intervalMs=6000,orderLabel}:Props){
 const [enabled,setEnabled]=useState(false),[sharing,setSharing]=useState(false),[error,setError]=useState('')
 const queue=useRef<Promise<unknown>>(Promise.resolve())
 useEffect(()=>{setEnabled(false);setSharing(false);setError('')},[deliveryId,disabled])
 useEffect(()=>{
 if(!enabled||disabled||!deliveryId)return
 let active=true,last=0
 if(!navigator.geolocation){setError('Location is unavailable. Your saved delivery address will be used.');setEnabled(false);return}
 const watcher=navigator.geolocation.watchPosition(pos=>{
 if(!active||Date.now()-last<intervalMs)return;last=Date.now()
 const input={lat:pos.coords.latitude,lng:pos.coords.longitude,delivery_id:deliveryId}
 queue.current=queue.current.catch(()=>{}).then(async()=>{if(!active)return;const r=await updateCustomerLocation(input);if(active){if(r.error){setError(r.error);setSharing(false)}else{setSharing(true);setError('')}}}).catch(()=>{if(active){setSharing(false);setError('Location update failed. Try again.')}})
 },()=>{if(active){setError('Location access was unavailable. Your delivery address will still be used.');setSharing(false);setEnabled(false)}},{enableHighAccuracy:true,maximumAge:2000,timeout:15000})
 return()=>{active=false;navigator.geolocation.clearWatch(watcher);setSharing(false);queue.current=queue.current.catch(()=>{}).then(async()=>{const r=await clearCustomerLocation(deliveryId);if(r.error)setError("Sharing has stopped on this device. The last signal will expire shortly.")}).catch(()=>setError("Sharing has stopped on this device. The last signal will expire shortly."))}
 },[enabled,disabled,deliveryId,intervalMs])
 if(disabled||!deliveryId)return null
 return <div className="text-xs text-white space-y-1">{orderLabel&&<p>Location sharing for {orderLabel}</p>}<button type="button" aria-pressed={enabled} className="rounded-full px-3 py-2 border border-cyan-500/30 bg-cyan-500/10" onClick={()=>{setError('');setEnabled(v=>!v)}}>{enabled?(sharing?'Stop sharing live location':'Stop locating…'):'Share live location with this driver'}</button><p className="text-gray-400">{enabled?'Only shared for this active delivery.':'Optional. Your delivery address is used when sharing is off.'}</p>{error&&<p role="alert" className="text-red-300">{error}</p>}</div>
}
