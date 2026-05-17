import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline } from "@/components/shared/timeline"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Package, User, Phone } from "lucide-react"
import Link from "next/link"
import { createClient } from "@/lib/supabase/server"
import { notFound } from "next/navigation"
import { UpdateStatusButton } from "@/components/driver/update-status-button"
import { SafetyCancelButton } from "@/components/driver/safety-cancel-button"
import { LiveTrackingPanel } from "@/components/tracking/live-tracking-panel"
import { DriverLocationBroadcaster } from "@/components/tracking/driver-location-broadcaster"

const STATUS_ORDER = ["requested", "accepted", "collected", "in_transit", "delivered"]
const STATUS_LABELS: Record<string, string> = {
  requested: "Job Requested",
  accepted: "Job Accepted",
  collected: "Package Picked Up",
  in_transit: "En Route to Delivery",
  delivered: "Delivered",
}

const STATUS_BADGE_MAP: Record<string, "active" | "pending" | "completed" | "cancelled" | "in_transit"> = {
  accepted: "active",
  collected: "active",
  in_transit: "in_transit",
  delivered: "completed",
  cancelled: "cancelled",
  requested: "pending",
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

  const [customerRes, logsRes] = await Promise.all([
    job.customer_id
      ? supabase.from("users").select("full_name, phone, email").eq("id", job.customer_id).single()
      : Promise.resolve({ data: null }),
    supabase
      .from("delivery_status_logs")
      .select("status, created_at")
      .eq("delivery_id", jobId)
      .order("created_at", { ascending: true }),
  ])

  const customer = customerRes.data
  const logs: { status: string; created_at: string }[] = logsRes.data ?? []
  const currentIdx = STATUS_ORDER.indexOf(job.status)

  const timelineSteps = STATUS_ORDER.filter((s) => s !== "requested").map((s, idx) => {
    const log = logs.find((l) => l.status === s)
    const realIdx = STATUS_ORDER.indexOf(s)
    const status: "completed" | "active" | "upcoming" =
      realIdx < currentIdx ? "completed" : realIdx === currentIdx ? "active" : "upcoming"
    return {
      label: STATUS_LABELS[s] ?? s,
      status,
      time: log
        ? new Date(log.created_at).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })
        : undefined,
    }
  })

  const badgeStatus = STATUS_BADGE_MAP[job.status] ?? "pending"

  const ACTIVE_STATUSES = ["accepted", "collected", "in_transit", "picked_up"]
  const isActive = ACTIVE_STATUSES.includes(job.status)
  const pickup = job.pickup_lat != null && job.pickup_lng != null
    ? { lat: Number(job.pickup_lat), lng: Number(job.pickup_lng) }
    : null
  const destination = job.delivery_lat != null && job.delivery_lng != null
    ? { lat: Number(job.delivery_lat), lng: Number(job.delivery_lng) }
    : null

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/dashboard/driver/active-jobs">
            <ArrowLeft className="h-4 w-4 mr-1" />Back
          </Link>
        </Button>
      </div>
      <PageHeader
        title={job.tracking_number ?? `Job #${jobId.slice(0, 8)}`}
        description="Job details and delivery progress"
      >
        <StatusBadge status={badgeStatus} />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Live Map */}
          {isActive && (
            <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-sm font-semibold text-foreground">Live Tracking</h2>
                <DriverLocationBroadcaster deliveryId={jobId} />
              </div>
              <LiveTrackingPanel
                driverId={user?.id ?? null}
                pickup={pickup}
                destination={destination}
                customerId={job.customer_id ?? null}
                driverLabel="You"
                followDriver
                height={360}
              />
              <p className="text-[11px] text-muted-foreground mt-3">
                Your location is shared with the customer while this job is active. Stop sharing by completing or cancelling the job.
              </p>
            </div>
          )}

          {/* Route */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Delivery Route</h2>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 items-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Pickup Address</p>
                  <p className="text-sm font-medium text-foreground">{job.pickup_address ?? "—"}</p>
                </div>
              </div>
              <div className="ml-4 border-l-2 border-dashed border-border h-4" />
              <div className="flex gap-3 items-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Delivery Address</p>
                  <p className="text-sm font-medium text-foreground">{job.delivery_address ?? "—"}</p>
                </div>
              </div>
            </div>
          </div>

          {/* Package */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">
              <Package className="h-4 w-4 inline mr-1.5" />Package Info
            </h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 text-sm">
              <div>
                <p className="text-xs text-muted-foreground mb-1">Description</p>
                <p className="font-medium">{job.item_description ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Declared Value</p>
                <p className="font-medium">{job.item_value != null ? `$${Number(job.item_value).toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Payout</p>
                <p className="font-medium">{job.price != null ? `$${Number(job.price).toFixed(2)}` : "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Tracking</p>
                <p className="font-medium font-mono text-xs">{job.tracking_number ?? "—"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Safe Item</p>
                <p className="font-medium">{job.is_safe_confirmed ? "Confirmed" : "Not confirmed"}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground mb-1">Status</p>
                <p className="font-medium capitalize">{job.status.replace("_", " ")}</p>
              </div>
            </div>
          </div>

          {/* Customer Contact */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Customer Contact</h2>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-foreground">{customer?.full_name ?? "—"}</p>
                <p className="text-xs text-muted-foreground">{customer?.email ?? "—"}</p>
              </div>
              {customer?.phone && (
                <Button variant="outline" size="sm" asChild>
                  <a href={`tel:${customer.phone}`}>
                    <Phone className="h-4 w-4 mr-1.5" />Call
                  </a>
                </Button>
              )}
            </div>
          </div>

          {/* Actions */}
          {job.status !== "delivered" && job.status !== "cancelled" && (
            <div className="flex gap-3">
              <UpdateStatusButton jobId={jobId} currentStatus={job.status} />
              <SafetyCancelButton jobId={jobId} />
            </div>
          )}
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
          <h2 className="text-sm font-semibold text-foreground mb-5">Progress</h2>
          <Timeline steps={timelineSteps} />
        </div>
      </div>
    </div>
  )
}
