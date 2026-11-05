"use client"
import {useEffect,useState} from "react"
import {getCancellationSettings} from "@/app/actions/cancellation"
import {cancellationSummary,type CancellationSettings} from "@/lib/cancellation-policy"
export function CancellationPolicyNotice(){
 const [config,setConfig]=useState<CancellationSettings|null>(null),[error,setError]=useState(false)
 useEffect(()=>{let active=true;getCancellationSettings().then(c=>{if(active)setConfig(c)}).catch(()=>{if(active)setError(true)});return()=>{active=false}},[])
 return <details className="my-3 rounded-lg border border-white/15 p-3 text-xs text-white"><summary className="cursor-pointer min-h-6">Cancellation policy</summary><p className="mt-2 leading-relaxed">{config?cancellationSummary(config):error?"Policy could not load. Read the Terms or contact Support before confirming payment.":"Loading policy…"}</p><a className="inline-flex min-h-11 items-center underline" href="/terms" target="_blank" rel="noreferrer">Read full Terms</a></details>
}
