'use client'
import { useEffect, useState } from 'react'
import { getSavedAddresses } from '@/app/actions/customer-repairs'
import { validCoordinates } from '@/lib/customer-validation'
import type { ShoppingPlace } from './ShoppingAddressField'
export function SavedAddressPicker({label,onSelect}:{label:string;onSelect:(place:ShoppingPlace)=>void}){
 const [addresses,setAddresses]=useState<{id:string;address:string;lat:number|null;lng:number|null}[]>([]),[error,setError]=useState(''),[retry,setRetry]=useState(0)
 useEffect(()=>{let alive=true;getSavedAddresses().then(r=>{if(alive){setAddresses(r.data);setError(r.error??'')}}).catch(()=>{if(alive)setError('Saved addresses unavailable.')});return()=>{alive=false}},[retry])
 return <div className="text-xs text-gray-300 my-2">{addresses.length>0&&<label>{label}<select aria-label={label} value="" className="block mt-1 w-full rounded-lg border border-white/20 bg-[#1b1d20] p-2 text-white" onChange={e=>{const a=addresses.find(a=>a.id===e.target.value);if(!a)return;const lat=a.lat==null?null:Number(a.lat),lng=a.lng==null?null:Number(a.lng);if(!validCoordinates(lat,lng)){setError('This older address needs a map pin. Select it from the address suggestions to confirm its location.');return}setError('');onSelect({address:a.address,lat:lat!,lng:lng!})}}><option value="">Choose a saved address</option>{addresses.map(a=><option key={a.id} value={a.id}>{a.address}</option>)}</select></label>}{error&&<p role="status">{error} <button type="button" className="underline" onClick={()=>setRetry(v=>v+1)}>Retry</button></p>}</div>
}
