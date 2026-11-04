"use client"
import { useState, useTransition } from "react"
import { setOrderTestRecord } from "@/app/actions/order-test-record"

export function TestOrderFlag({id,flagged,canEdit}: {id:string;flagged:boolean;canEdit:boolean}) {
  const [active,setActive] = useState(flagged)
  const [pending,start] = useTransition()
  const [error,setError] = useState("")
  if (!active && !canEdit) return null
  return <div className="mb-4 text-sm text-[var(--color-on-surface-variant)]">
    {active && <p>Flagged as a test record. Order and payment history are kept.</p>}
    {canEdit && <button type="button" className="underline" disabled={pending} onClick={()=>start(async()=>{
      setError("")
      try {
        const result = await setOrderTestRecord(id,!active)
        if (result.error) setError(result.error)
        else setActive(!active)
      } catch { setError("Could not save the flag. Please retry.") }
    })}>{active?"Remove test record flag":"Flag as test record"}</button>}
    {error && <p role="alert">{error}</p>}
  </div>
}
