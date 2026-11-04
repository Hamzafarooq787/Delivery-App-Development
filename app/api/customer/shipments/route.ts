import { createClient } from "@/lib/supabase/server"
import { SHIPMENT_COLUMNS } from "@/lib/shipment-query"

export async function GET(request: Request) {
  const deadline = AbortSignal.any([request.signal, AbortSignal.timeout(2400)])
  const boundedFetch: typeof fetch = (input, options) => fetch(input, {
    ...options, cache: "no-store", signal: options?.signal ? AbortSignal.any([deadline, options.signal]) : deadline,
  })
  const reply = (body: unknown, status = 200) => Response.json(body, {status, headers:{"Cache-Control":"private, no-store"}})
  try {
    const params = new URL(request.url).searchParams
    const id = params.get("id")
    if (id && !/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(id)) return reply({error:"Invalid shipment."},400)
    const db = await createClient(boundedFetch)
    const {data:{user},error:authError} = await db.auth.getUser()
    if (deadline.aborted || (authError && authError.name === "AuthRetryableFetchError")) return reply({error:"Shipments are taking too long to load. Please retry."},504)
    if (!user || authError) return reply({error:"Please sign in to see your shipments."},401)

    // RLS remains active. Never accept a customer ID from the browser.
    const base = db.from("delivery_requests").select(SHIPMENT_COLUMNS,{count:id ? undefined : "exact"}).eq("customer_id",user.id).abortSignal(deadline)
    if (id) {
      const {data,error} = await base.eq("id",id).maybeSingle()
      if (error) throw error
      return data ? reply({shipment:data}) : reply({error:"Shipment not found."},404)
    }
    const size = Math.max(1,Math.min(20,Math.trunc(Number(params.get("size"))) || 5))
    const page = Math.max(1,Math.min(10000,Math.trunc(Number(params.get("page"))) || 1))
    const term = (params.get("search") ?? "").slice(0,100).replace(/[^\p{L}\p{N} .'-]/gu," ").trim()
    let query = params.get("history") === "1" ? base.in("status",["delivered","cancelled"]) : base.not("status","in","(delivered,cancelled)")
    if (term) query = query.or(`tracking_number.ilike.%${term}%,pickup_address.ilike.%${term}%,delivery_address.ilike.%${term}%`)
    const {data,count,error} = await query.order("created_at",{ascending:false}).order("id",{ascending:false}).range((page-1)*size,page*size-1)
    if (error) throw error
    return reply({rows:data ?? [],count:count ?? 0})
  } catch {
    return reply({error:deadline.aborted ? "Shipments are taking too long to load. Please retry." : "Could not load shipments. Please try again."}, deadline.aborted ? 504 : 503)
  }
}
