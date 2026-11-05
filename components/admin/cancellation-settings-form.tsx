"use client"
import {useEffect,useState} from "react"
import {getCancellationSettings,saveCancellationSettings} from "@/app/actions/cancellation"
import type {CancellationSettings} from "@/lib/cancellation-policy"
export function CancellationSettingsForm(){
 const [config,setConfig]=useState<CancellationSettings|null>(null),[message,setMessage]=useState(""),[busy,setBusy]=useState(false)
 useEffect(()=>{getCancellationSettings().then(setConfig).catch(()=>setMessage("Cancellation settings could not load."))},[])
 return <section className="my-5 rounded-xl bg-[var(--brand-panel)] p-5 text-white space-y-3"><h2 className="text-lg font-bold">Cancellation fees and compensation</h2><p className="text-sm">Before travel: full refund. Driver fault or no-show: full refund. Purchased goods: admin review.</p>{config&&<><div className="grid gap-4 sm:grid-cols-2">{(["travelFee","travelDriver","arrivedFee","arrivedDriver"] as const).map((key,i)=><label key={key}>{["Travel started · customer fee (£)","Travel started · driver compensation (£)","Arrived · customer fee (£)","Arrived · driver compensation (£)"][i]}<input className="block w-full rounded bg-black/30 p-3" type="number" min={0} max={100} step={0.01} value={config[key]} onChange={event=>setConfig({...config,[key]:Number(event.target.value)})}/></label>)}</div><button disabled={busy} className="min-h-11 rounded-lg bg-[var(--brand-strong)] px-4 text-[var(--brand-ink)]" onClick={async()=>{setBusy(true);try{const r=await saveCancellationSettings(config);setMessage(r.error??"Policy saved. Current cancellation quotes use these fees.")}catch{setMessage("Policy could not save.")}finally{setBusy(false)}}}>Save cancellation settings</button></>}<p role="status">{message}</p></section>
}
