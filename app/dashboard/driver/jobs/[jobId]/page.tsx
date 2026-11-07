import Link from "next/link"
import {timelineTime} from '@/lib/timeline-time'
import { createClient } from "@/lib/supabase/server"
import { getDriverCustomerContact } from "@/app/actions/driver-operations"
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
  if (!/^[0-9a-f]{8}(?:-[0-9a-f]{4}){3}-[0-9a-f]{12}$/i.test(jobId)) notFound()
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  if (!user) notFound()
  const { data: job, error } = await supabase
    .from("delivery_requests")
    .select("*")
    .eq("id", jobId)
    .eq("driver_id", user?.id ?? "")
    .maybeSingle()

  if (error || !job) return <section className="mx-auto my-8 max-w-xl rounded-xl border border-white/20 p-6 text-white">
    <h1 className="text-xl font-bold">{error ? "This job could not load" : "This job is no longer assigned to you"}</h1>
    <p className="my-3 text-sm">{error ? "Try reopening the job from your jobs list." : "It may have been released or reassigned. You can check your current jobs below."}</p>
    <Link href="/dashboard/driver/active-jobs" className="mr-4 underline">Back to Active Jobs</Link>
    <Link href="/dashboard/driver/jobs/available" className="underline">Browse Available Jobs</Link>
  </section>

  const [customerRes, logsRes,profileRes,earningsRes] = await Promise.all([
    getDriverCustomerContact(jobId).then(data=>({data})),
    supabase
      .from("delivery_status_logs")
      .select("status, created_at, occurred_at_known")
      .eq("delivery_id", jobId)
      .order("created_at", { ascending: true }),
    supabase.from("driver_profiles").select("status").eq("id",user.id).maybeSingle(),
    ["delivered","cancelled"].includes(job.status)
      ? supabase.from("driver_earnings").select("amount").eq("driver_id",user.id).or(`delivery_id.eq.${jobId},recovery_delivery_id.eq.${jobId}`)
      : Promise.resolve({data:null,error:null}),
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
    <><DriverJobView
      canOperate={profileRes.data?.status==="approved"&&!(job.recovery_case?.status==="open"&&["return_to_pickup","verification_hold","cancellation_review"].includes(job.recovery_case?.action))}
      job={job}
      settledEarnings={earningsRes.error ? null : earningsRes.data?.length ? earningsRes.data.reduce((total,row)=>total+Number(row.amount),0) : job.status==="cancelled" ? 0 : undefined}
      customer={customer}
      timelineSteps={timelineSteps}
      userId={user?.id ?? ""}
    /></>
  )
}
