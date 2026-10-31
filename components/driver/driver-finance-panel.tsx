'use client'
import Link from 'next/link'
import { useEffect, useRef, useState, useTransition } from 'react'
import type { DriverFinanceSnapshot } from '@/lib/driver-finance'
import { getDriverFinance } from '@/app/actions/driver-operations'
import { ConnectBankButton } from './connect-bank-button'
import { RequestPayoutButton } from './request-payout-button'

const money=(v:unknown)=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP'}).format(Number(v)||0)
export function DriverFinancePanel({initial,payouts=false}:{initial:DriverFinanceSnapshot;payouts?:boolean}){
 const [data,setData]=useState(initial),[page,setPage]=useState(1),[period,setPeriod]=useState('all'),[error,setError]=useState(''),[busy,start]=useTransition()
 const request=useRef(0)
 useEffect(()=>{if(page===1&&period==='all'){request.current++;setData(initial)}else load(page,period)},[initial])
 function load(nextPage:number,nextPeriod=period){const version=++request.current;start(async()=>{setError('');try{const r=await getDriverFinance(nextPage,nextPeriod,payouts);if(version!==request.current)return;if(r.error||!r.data)setError(r.error||'Earnings could not load. Please retry.');else{setData(r.data);setPage(nextPage);setPeriod(nextPeriod)}}catch{if(version===request.current)setError('Could not load this page. Please retry.')}})}
 return <div className="space-y-5 p-4 text-white">
  <nav className="flex gap-5"><Link className="text-[var(--brand-soft)]" href="/dashboard/driver/earnings">Earnings</Link><Link className="text-[var(--brand-soft)]" href="/dashboard/driver/payouts">Payouts</Link></nav>
  <h1 className="text-3xl font-bold">{payouts?'Payouts':'Earnings'}</h1>
  <div className="grid gap-3 sm:grid-cols-3">{[['Available',data.totals.available],['Total earned',data.totals.total],['Paid out',data.paid]].map(([label,value])=><div key={String(label)} className="rounded-2xl border border-white/10 bg-[var(--brand-panel)] p-5"><p className="text-sm text-gray-300">{label}</p><p className="mt-2 text-3xl font-bold">{money(value)}</p></div>)}</div>
  {payouts?<><RequestPayoutButton pendingBalance={Number(data.totals.available)}/><ConnectBankButton/></>:<p className="text-sm text-gray-300">Agreed earnings include any minimum-pay subsidy. Commission applies only to service fees. All dates use UK time.</p>}
  {!payouts&&<label className="block text-sm">Period <select disabled={busy} value={period} onChange={e=>load(1,e.target.value)} className="ml-3 rounded bg-[var(--brand-panel)] p-3">{[['all','All time'],['day','Today'],['week','This week'],['month','This month']].map(([v,l])=><option key={v} value={v}>{l}</option>)}</select></label>}
  {error&&<p role="alert" className="text-red-300">{error}<button onClick={()=>load(page)} className="ml-3 underline">Retry</button></p>}
  <div className="overflow-x-auto rounded-2xl border border-white/10 bg-[var(--brand-panel)]"><table className="w-full text-left text-sm"><thead><tr>{(payouts?['Date','Reference','Amount','Status']:['Date','Delivery','Service fee','Commission / subsidy','Your earnings']).map(label=><th key={label} className="p-4">{label}</th>)}</tr></thead><tbody>{data.rows.map(r=><tr key={r.id} className="border-t border-white/10"><td className="p-4 whitespace-nowrap">{new Date(r.created_at).toLocaleDateString('en-GB',{timeZone:'Europe/London'})}</td>{payouts?<><td className="p-4">{r.payment_reference||r.id.slice(0,8)}</td><td className="p-4">{money(r.amount)}</td><td className="p-4">{r.status}{r.provider?.error&&<p className="text-red-300">Bank payment needs attention. Contact support.</p>}</td></>:<><td className="p-4">{r.delivery_requests?.tracking_number||r.id.slice(0,8)}{r.delivery_requests?.adjustment&&<p className="text-xs text-gray-300">{r.delivery_requests.adjustment}</p>}</td><td className="p-4">{money(r.delivery_requests?.price)}</td><td className="p-4">{Number(r.commission_amount)<0?'Subsidy ':''}{money(Math.abs(Number(r.commission_amount)))}</td><td className="p-4 font-bold text-[var(--brand-soft)]">{money(r.amount)}</td></>}</tr>)}</tbody></table>{!data.rows.length&&<p className="p-6">No records for this period.</p>}</div>
  <div className="flex items-center justify-between"><button className="rounded border border-white/20 px-4 py-3 disabled:opacity-40" disabled={busy||page<=1} onClick={()=>load(page-1)}>Previous</button><span>Page {page} of {Math.max(1,Math.ceil(data.count/20))}</span><button className="rounded border border-white/20 px-4 py-3 disabled:opacity-40" disabled={busy||page*20>=data.count} onClick={()=>load(page+1)}>Next</button></div>
 </div>
}
