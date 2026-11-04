"use client"

import { useEffect, useState } from "react"

const LABELS: Record<string,string> = {
  identity: "Identity / Driving Licence", insurance: "Insurance Policy",
  vehicle_registration: "Vehicle Registration", selfie: "Selfie",
}

export function DocumentPreviewModal({doc,onClose}:{doc:{document_type:string;file_url:string;media_kind?:"image"|"pdf"|"unknown"};onClose:()=>void}) {
  const label=LABELS[doc.document_type]??doc.document_type
  const image=doc.media_kind==="image"
  const pdf=doc.media_kind==="pdf"
  const [status,setStatus]=useState<"loading"|"ready"|"error">(image||pdf?"loading":"error")

  useEffect(()=>{
    const key=(event:KeyboardEvent)=>{if(event.key==="Escape")onClose()}
    document.addEventListener("keydown",key)
    return ()=>document.removeEventListener("keydown",key)
  },[onClose])

  return <div className="fixed inset-0 z-50 flex items-center justify-center p-3">
    <div className="absolute inset-0 bg-black/85" onClick={onClose}/>
    <section role="dialog" aria-modal="true" aria-label={label} className="relative flex h-[85dvh] max-h-[900px] w-full max-w-4xl flex-col overflow-hidden rounded-2xl border border-white/15 bg-[var(--brand-panel)]">
      <header className="flex shrink-0 flex-wrap items-center justify-between gap-2 border-b border-white/15 p-4 text-white">
        <h2 className="font-bold">{label}</h2>
        <div className="flex items-center gap-3 text-sm">
          <a href={doc.file_url} target="_blank" rel="noreferrer" className="underline">Open original</a>
          <button type="button" autoFocus aria-label="Close preview" onClick={onClose} className="rounded-md border border-white/20 px-3 py-1">Close</button>
        </div>
      </header>
      <div className="relative min-h-0 flex-1 overflow-hidden bg-[var(--brand-bg)] p-2">
        {image && status!=="error" &&
          // eslint-disable-next-line @next/next/no-img-element
          <img src={doc.file_url} alt={label} onLoad={()=>setStatus("ready")} onError={()=>setStatus("error")} className="h-full w-full object-contain" />}
        {pdf && status!=="error" && <iframe src={doc.file_url} title={label} onLoad={()=>setStatus("ready")} onError={()=>setStatus("error")} className="h-full w-full border-0"/>}
        {status!=="ready" && <p role="status" className="pointer-events-none absolute inset-0 grid place-items-center bg-[var(--brand-bg)] px-4 text-center text-sm text-white">
          {status==="loading"?"Loading document preview…":"Preview unavailable. Use Open original to view the file."}
        </p>}
      </div>
    </section>
  </div>
}
