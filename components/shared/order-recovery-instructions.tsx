'use client'
import {useEffect,useState,useTransition} from 'react'
import Link from 'next/link'
import {getOrderRecovery,acknowledgeOrderRecovery} from '@/app/actions/admin-operations'
type Recovery=NonNullable<Awaited<ReturnType<typeof getOrderRecovery>>['data']>
export function OrderRecoveryInstructions({id,driver=false}:{id:string;driver?:boolean}){
 const [record,setRecord]=useState<Recovery|null>(null),[error,setError]=useState(''),[busy,start]=useTransition()
 useEffect(()=>{let alive=true,pending=false;const refresh=async()=>{if(pending||document.hidden)return;pending=true;try{const r=await getOrderRecovery(id);if(alive){if(r.error)setError(r.error);else{setRecord(r.data??null);setError('')}}}catch{if(alive)setError('Support updates could not load. Please refresh.')}finally{pending=false}};void refresh();const timer=setInterval(refresh,10000);window.addEventListener('focus',refresh);return()=>{alive=false;clearInterval(timer);window.removeEventListener('focus',refresh)}},[id])
 if(!record&&!error)return null
 return <section aria-label="Delivery support instructions" className="m-4 rounded-xl border border-orange-400/50 bg-[var(--brand-panel)] p-4 text-white space-y-3"><h2 className="font-bold">Delivery support update</h2>{error&&<p role="alert">{error}</p>}{record&&<><p>{record.instruction}</p>{record.returnAddress&&<p>Return address: {record.returnAddress}</p>}<p>{record.acknowledged?'Driver has acknowledged these instructions.':'Waiting for driver acknowledgement.'}</p>{driver&&record.canAcknowledge&&!record.acknowledged&&<button disabled={busy} className="rounded bg-[var(--brand-strong)] p-3 text-black disabled:opacity-50" onClick={()=>start(async()=>{try{const r=await acknowledgeOrderRecovery(id,record.version);if(r.error)setError(r.error);else setRecord({...record,acknowledged:true})}catch{setError('Acknowledgement could not save. Please retry.')}})}>{busy?'Saving…':'I have read these instructions'}</button>}</>}<Link className="underline" href={driver?'/dashboard/driver/support':'/dashboard/customer/support'}>Contact support</Link></section>
}
