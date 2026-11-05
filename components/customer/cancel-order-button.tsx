"use client"
import {createPortal} from "react-dom"
import {useEffect,useState} from "react"
import {getCancellationQuote,cancelByPolicy} from "@/app/actions/cancellation"
type Quote=NonNullable<Awaited<ReturnType<typeof getCancellationQuote>>["data"]>
export function CancelOrderButton({deliveryId,currentStatus,onCancelled,fault="customer"}:{deliveryId:string;currentStatus:string;onCancelled?:()=>void;fault?:"customer"|"driver"}){
 const [open,setOpen]=useState(false),[busy,setBusy]=useState(false),[error,setError]=useState(""),[quote,setQuote]=useState<Quote|null>(null)
 const [reason,setReason]=useState("")
 const [remaining,setRemaining]=useState(0)
 useEffect(()=>{
  if(!open||!quote?.graceSeconds){setRemaining(0);return}
  const end=performance.now()+quote.graceSeconds*1000
  const tick=()=>setRemaining(Math.max(0,Math.ceil((end-performance.now())/1000)))
  tick()
  const timer=setInterval(tick,1000)
  const refresh=setTimeout(()=>{
   setBusy(true)
   getCancellationQuote(deliveryId,fault).then(r=>{setQuote(r.data??null);if(r.error)setError(r.error)}).catch(()=>{setQuote(null);setError("Refresh cancellation details before confirming.")}).finally(()=>setBusy(false))
  },quote.graceSeconds*1000)
  return()=>{clearInterval(timer);clearTimeout(refresh)}
 },[open,quote,deliveryId,fault])
 if(["delivered","cancelled"].includes(currentStatus))return null
 return <>
 <button disabled={busy} className="min-h-11 rounded-xl border border-red-400/40 px-4 text-sm text-red-200" onClick={async()=>{setOpen(true);setBusy(true);setError("");try{const r=await getCancellationQuote(deliveryId,fault);setQuote(r.data??null);if(r.error)setError(r.error)}catch{setError("Cancellation details could not load.")}finally{setBusy(false)}}}>{fault==="driver"?"Cancel job — driver fault":"Cancel order"}</button>
 {open&&createPortal(<div role="dialog" aria-modal="true" aria-label="Cancel order" className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/70 p-4"><section className="w-full max-w-md rounded-2xl border border-white/20 bg-[var(--brand-panel)] p-5 text-white space-y-4 max-h-[90dvh] overflow-y-auto">
 <h2 className="font-bold">{fault==="driver"?"Cancel job — driver fault":"Cancel order"}</h2>{fault==="driver"&&<><p>The customer receives a full refund with no cancellation fee. Purchased shopping must be reviewed by admin first.</p><label className="block">Reason (at least 5 characters)<textarea className="mt-1 block w-full rounded bg-black/30 p-3" value={reason} maxLength={500} onChange={e=>setReason(e.target.value)}/></label></>}
 {busy&&!quote&&<p>Loading cancellation details…</p>}
 {quote&&(quote.review?<p>This order needs an admin review. No automatic refund will be issued. Support will check whether goods can be returned or delivery should continue.</p>:<><p role="status">{remaining>0?`Free cancellation grace time left: ${Math.floor(remaining/60)}:${String(remaining%60).padStart(2,"0")}. Arrival ends the grace period.`:"Any travel grace period is checked again when you confirm."}</p><p>Cancellation fee: <strong>£{Number(quote.fee).toFixed(2)}</strong></p><p>Refund requested: <strong>£{Number(quote.refund).toFixed(2)}</strong> to your original payment method.</p><p>The driver stage is checked again when you confirm. If the fee changes, you will be asked to review it.</p></>)}
 {error&&<p role="alert">{error}</p>}
 <div className="flex gap-3"><button disabled={busy} className="min-h-11 flex-1 rounded-lg border border-white/20" onClick={()=>setOpen(false)}>Keep order</button><button disabled={busy||!quote?.canCancel||(fault==="driver"&&reason.trim().length<5)} className="min-h-11 flex-1 rounded-lg bg-[var(--brand-strong)] text-[var(--brand-ink)]" onClick={async()=>{if(!quote)return;setBusy(true);try{const r=await cancelByPolicy(deliveryId,Number(quote.fee),fault==="driver"?reason.trim():"Customer cancellation",fault);if(r.error){setError(r.error);const latest=await getCancellationQuote(deliveryId,fault);setQuote(latest.data??null)}else{setOpen(false);onCancelled?.()}}catch{setError("Cancellation could not be confirmed. Check the order before retrying.")}finally{setBusy(false)}}}>{busy?"Saving…":quote?.review?"Request admin review":quote?.fee?`Cancel · £${Number(quote.fee).toFixed(2)} fee`:"Cancel for free"}</button></div>
 </section></div>,document.body)}
 </>
}
