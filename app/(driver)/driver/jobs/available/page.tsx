import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { MapPin, Package, DollarSign, Clock } from "lucide-react"
import Link from "next/link"

const availableJobs = [
  { id: "JOB-010", pickup: "—", delivery: "—", distance: "—", payout: "—", weight: "—" },
  { id: "JOB-011", pickup: "—", delivery: "—", distance: "—", payout: "—", weight: "—" },
  { id: "JOB-012", pickup: "—", delivery: "—", distance: "—", payout: "—", weight: "—" },
]

export default function AvailableJobsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Available Jobs" description="Browse and accept available delivery jobs." />

      <div className="flex flex-col gap-4">
        {availableJobs.map((job) => (
          <div key={job.id} className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <div className="flex items-start justify-between gap-4 mb-4">
              <div>
                <p className="text-xs font-mono text-muted-foreground mb-1">{job.id}</p>
                <StatusBadge status="available" />
              </div>
              <div className="text-right">
                <p className="text-xs text-muted-foreground mb-0.5">Payout</p>
                <div className="flex items-center gap-1">
                  <DollarSign className="h-4 w-4 text-foreground" />
                  <span className="text-sm font-semibold text-foreground">{job.payout}</span>
                </div>
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-4">
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Pickup</p>
                  <p className="text-sm text-foreground">{job.pickup}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <MapPin className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Delivery</p>
                  <p className="text-sm text-foreground">{job.delivery}</p>
                </div>
              </div>
              <div className="flex items-start gap-2">
                <Package className="h-4 w-4 text-muted-foreground mt-0.5 shrink-0" />
                <div>
                  <p className="text-xs text-muted-foreground">Weight</p>
                  <p className="text-sm text-foreground">{job.weight}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
                <Clock className="h-3.5 w-3.5" />
                <span>Distance: {job.distance}</span>
              </div>
              <div className="flex gap-2">
                <Button variant="outline" size="sm" asChild>
                  <Link href={`/driver/jobs/${job.id}`}>Details</Link>
                </Button>
                <Button size="sm">Accept Job</Button>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
