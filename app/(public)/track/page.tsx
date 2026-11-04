import type { Metadata } from "next"
import { createAdminClient } from "@/lib/supabase/admin"
import { normaliseTrackingNumber, trackingLabels } from "@/lib/public-tracking"

export const metadata: Metadata = { title: "Track a shipment | GoDrop", robots: { index: false, follow: true } }

export default async function PublicTrackPage({searchParams}: {searchParams:Promise<{number?:string|string[]}>}) {
  const {number:raw} = await searchParams
  const number = normaliseTrackingNumber(raw)
  let result: string | null = null
  let failure = false
  if (number) {
    try {
      // Only the status is public. Addresses, item details and account data stay private.
      const {data,error} = await createAdminClient().from("delivery_requests")
        .select("status").eq("tracking_number",number).maybeSingle()
      failure = !!error
      if (data) result = trackingLabels[data.status] ?? "Status unavailable"
    } catch { failure = true }
  }
  return <section className="mx-auto max-w-3xl px-4 pt-28 pb-16 md:px-6">
    <h1 className="text-3xl font-bold mb-4">Track a shipment</h1>
    <p className="text-sm text-[#adaaaa] mb-6">Enter the tracking number from your booking confirmation.</p>
    <form action="/track" className="flex flex-wrap gap-2 rounded-xl border border-border bg-card p-6">
      <label htmlFor="tracking-number" className="w-full text-sm font-medium">Tracking number</label>
      <input id="tracking-number" name="number" required type="search" maxLength={80} defaultValue={number ?? ""} className="min-w-0 flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm" />
      <button className="h-10 rounded-lg bg-[var(--brand-strong)] px-4 font-semibold text-white">Track</button>
    </form>
    {raw !== undefined && <div role="status" className="mt-6 rounded-xl border border-border bg-card p-6">
      {result ? <><p className="text-sm text-[#adaaaa]">{number}</p><p className="mt-1 font-semibold">{result}</p></>
        : failure ? <p>Tracking is temporarily unavailable. Please try again.</p>
        : <p>Shipment not found. Check the tracking number and try again.</p>}
    </div>}
  </section>
}
