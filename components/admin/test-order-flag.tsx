"use client"
import { useState } from "react"
import { Flag } from "lucide-react"
import { toast } from "sonner"
import { setOrderTestRecord } from "@/app/actions/order-test-record"
import { shortRequest } from "@/lib/short-request"

export function TestOrderFlag({id,flagged,canEdit}: {id:string;flagged:boolean;canEdit:boolean}) {
  const [active,setActive] = useState(flagged)
  const [pending,setPending] = useState(false)
  const [error,setError] = useState("")
  if (!active && !canEdit) return null
  async function toggle() {
    if (pending) return
    setPending(true);setError("")
    try {
      const result = await shortRequest(setOrderTestRecord(id,!active),5500)
      if (result.error) {setError(result.error);toast.error(result.error);return}
      setActive(result.flagged === true)
      toast.success(result.flagged ? "Order flagged as a test record." : "Test record flag removed.")
    } catch {
      const message = "Could not confirm the flag. Reload to check the saved status before retrying."
      setError(message);toast.error(message)
    } finally { setPending(false) }
  }
  return <div className="mb-5 flex flex-wrap items-center gap-3 rounded-xl border border-white/10 bg-[var(--brand-panel)] p-3 text-sm text-white">
    {active && <span role="status" className="rounded-full bg-amber-400/15 px-3 py-1 font-semibold text-amber-200">Test record</span>}
    {canEdit && <button type="button" className="inline-flex items-center gap-2 rounded-lg border border-white/20 px-3 py-2 font-semibold hover:bg-white/10 disabled:opacity-60" disabled={pending} onClick={toggle}><Flag size={16} aria-hidden />{pending ? "Saving…" : active ? "Remove test flag" : "Flag as test record"}</button>}
    {active && <p className="text-[var(--color-on-surface-variant)]">Order and payment history are kept.</p>}
    {error && <p role="alert" className="w-full text-red-300">{error}</p>}
  </div>
}
