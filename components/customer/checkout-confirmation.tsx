'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'
import { getCheckoutOutcome } from '@/app/actions/order-checkout'
import { ClearCompletedBookingDraft } from './pending-order-checkouts'
export function CheckoutConfirmation({sessionId}:{sessionId:string}){
 const [result,setResult]=useState<Awaited<ReturnType<typeof getCheckoutOutcome>>|null>(null),[retry,setRetry]=useState(0),[waiting,setWaiting]=useState(true)
 useEffect(()=>{let alive=true,timer:ReturnType<typeof setTimeout>,attempts=0;setWaiting(true)
 const check=async()=>{try{const r=await getCheckoutOutcome(sessionId);if(!alive)return;setResult(r);if('data'in r&&r.data){setWaiting(false);return}}catch{if(alive)setResult({error:'Could not confirm payment. Please try again; do not pay again.'})}if(alive){if(++attempts<15)timer=setTimeout(check,3000);else setWaiting(false)}}
 void check();return()=>{alive=false;clearTimeout(timer)}},[sessionId,retry])
 if(result&&'data'in result&&result.data)return <><h1 className="text-2xl font-bold">Thank you — your order is confirmed</h1><ClearCompletedBookingDraft kind={result.data.service_type??'delivery'}/><p className="my-4">Tracking code: <strong>{result.data.tracking_number}</strong></p><Link className="block rounded-xl bg-[var(--brand-strong)] p-4" href={`/dashboard/customer/tracking?id=${result.data.id}`}>Track your order</Link></>
 return <><h1 className="text-2xl font-bold">Confirming your payment</h1><p role="status" className="my-4">{waiting?'Checking payment and preparing your order…':result?.error??'Confirmation is taking longer than expected. Check again or contact support. Please do not pay again.'}</p><button className="underline" onClick={()=>setRetry(v=>v+1)} disabled={waiting}>{waiting?'Checking automatically…':'Check payment again'}</button></>
}
