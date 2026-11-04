"use client"
import {useState} from "react"

export function OrderMediaPreview({src,alt}: {src:string;alt:string}) {
  const [failed,setFailed] = useState(false)
  if (failed) return <span className="grid h-full w-full place-items-center px-2 text-center text-xs text-[var(--color-on-surface-variant)]">Photo unavailable. Open the link to retry.</span>
  return <img src={src} alt={alt} loading="lazy" decoding="async" onError={()=>setFailed(true)} className="h-full w-full object-cover" />
}
