"use client"
import {useState} from "react"
import {getCancellationQuote,cancelByPolicy} from "@/app/actions/cancellation"
type Quote=NonNullable<Awaited<ReturnType<typeof getCancellationQuote>>["data"]>
export function CancelOrderButton({deliveryId,currentStatus,onCancelled}:{deliveryId:string;currentStatus:string;onCancelled?:()=>void}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[quote,setQuote]=useState<Quote|null>(null)
 if(["delivered","cancelled"].includes(currentStatus))return null
 return <>
 <button disabled={busy} className="min-h-11 rounded-xl border border-red-400/40 px-4 text-sm text-red-200" onClick={async()=>{setOpen(true);setBusy(true);setError("");try{const r=await getCancellationQuote(deliveryId);setQuote(r.data??null);if(r.error)setError(r.error)}catch{setError("Cancellation details could not load.")}finally{setBusy(false)}}}>Cancel order</button>
 {open&&<div role="dialog" aria-modal="true" aria-label="Cancel order" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl border border-white/20 bg-[var(--brand-panel)] p-5 text-white space-y-4">
 <h2 className="font-bold">Cancel order</h2>
 {busy&&!quote&&<p>Loading cancellation details…</p>}
 {quote&&(quote.review?<p>This order needs an admin review. No automatic refund will be issued. Support will check whether goods can be returned or delivery should continue.</p>:<><p>Cancellation fee: <strong>£{Number(quote.fee).toFixed(2)}</strong></p><p>Refund requested: <strong>£{Number(quote.refund).toFixed(2)}</strong> to your original payment method.</p><p>The driver stage is checked again when you confirm. If the fee changes, you will be asked to review it.</p></>)}
 {error&&<p role="alert">{error}</p>}
 <div className="flex gap-3"><button disabled={busy} className="min-h-11 flex-1 rounded-lg border border-white/20" onClick={()=>setOpen(false)}>Keep order</button><button disabled={busy||!quote?.canCancel} className="min-h-11 flex-1 rounded-lg bg-[var(--brand-strong)] text-[var(--brand-ink)]" onClick={async()=>{if(!quote)return;setBusy(true);try{const r=await cancelByPolicy(deliveryId,Number(quote.fee));if(r.error)setError(r.error);else{setOpen(false);onCancelled?.()}}catch{setError("Cancellation could not be confirmed. Check the order before retrying.")}finally{setBusy(false)}}}>{busy?"Saving…":quote?.review?"Request admin review":quote?.fee?`Cancel · £${Number(quote.fee).toFixed(2)} fee`:"Cancel for free"}</button></div>
 </section></div>}
 </>
}
