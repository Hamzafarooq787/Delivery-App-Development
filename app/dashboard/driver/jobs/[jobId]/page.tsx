import {timelineTime} from '@/lib/timeline-time'
import { createClient } from "@/lib/supabase/server"
import { getDriverCustomerContact } from "@/app/actions/driver-operations"
import { DriverRefresh } from "@/components/driver/driver-refresh"
import { notFound } from "next/navigation"
import { DriverJobView } from "@/components/driver/driver-job-view"

const STATUS_ORDER = ["requested", "accepted", "collected", "in_transit", "delivered"]
const STATUS_LABELS: Record<string, string> = {
  accepted: "Heading to Pickup",
  collected: "Parcel Collected",
  in_transit: "En Route to Delivery",
  delivered: "Delivered",
}

export default async function JobDetailPage({
  params,
}: {
  params: Promise<{ jobId: string }>
}) {
  const { jobId } = await params
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: job, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .eq("id", jobId)
    .eq("driver_id", user?.id ?? "")
    .single()

  if (error || !job) notFound()

  const [customerRes, logsRes,profileRes] = await Promise.all([
    getDriverCustomerContact(jobId).then(data=>({data})),
    supabase
      .from("delivery_status_logs")
      .select("status, created_at, occurred_at_known")
      .eq("delivery_id", jobId)
      .order("created_at", { ascending: true }),
    supabase.from("driver_profiles").select("status").eq("id",user?.id??"").maybeSingle(),
  ])

  const customer = customerRes.data
  const logs: { status: string; created_at: string;occurred_at_known?:boolean }[] = logsRes.data ?? []
  const currentIdx = STATUS_ORDER.indexOf(job.status)

  const timelineSteps = STATUS_ORDER.filter((s) => s !== "requested").map((s) => {
    const log = logs.find((l) => l.status === s)
    const realIdx = STATUS_ORDER.indexOf(s)
    const status: "completed" | "active" | "upcoming" =
      realIdx < currentIdx ? "completed" : realIdx === currentIdx ? "active" : "upcoming"
    return {
      label: STATUS_LABELS[s] ?? s.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      status,
      time: log&&log.occurred_at_known!==false
        ? timelineTime(log.created_at,true)
        : log?"Time unavailable":undefined,
    }
  })

  return (
    <><DriverRefresh/><DriverJobView
      canOperate={profileRes.data?.status==="approved"&&!(job.recovery_case?.status==="open"&&["return_to_pickup","verification_hold"].includes(job.recovery_case?.action))}
      job={job}
      customer={customer}
      timelineSteps={timelineSteps}
      userId={user?.id ?? ""}
    /></>
  )
}
