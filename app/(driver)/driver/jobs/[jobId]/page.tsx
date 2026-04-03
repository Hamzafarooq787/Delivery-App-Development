import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline } from "@/components/shared/timeline"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Package, User, Phone, CheckCircle, XCircle } from "lucide-react"
import Link from "next/link"

const timelineSteps = [
  { label: "Job Assigned", description: "Job was assigned to you.", status: "completed" as const, time: "—" },
  { label: "En Route to Pickup", description: "Heading to pickup address.", status: "completed" as const, time: "—" },
  { label: "Picked Up", description: "Package collected.", status: "active" as const, time: "—" },
  { label: "En Route to Delivery", description: "Heading to delivery address.", status: "upcoming" as const },
  { label: "Delivered", description: "Package delivered successfully.", status: "upcoming" as const },
]

export default function JobDetailPage({ params }: { params: { jobId: string } }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/driver/jobs/available"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
      </div>
      <PageHeader title={`Job ${params.jobId}`} description="Job details and delivery progress">
        <StatusBadge status="active" />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-5">
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
                  <div className="h-4 w-48 rounded bg-secondary"></div>
                </div>
              </div>
              <div className="ml-4 border-l-2 border-dashed border-border h-4"></div>
              <div className="flex gap-3 items-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Delivery Address</p>
                  <div className="h-4 w-48 rounded bg-secondary"></div>
                </div>
              </div>
            </div>
          </div>

          {/* Package */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Package Info</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {["Type", "Weight", "Description", "Service", "Payout", "Customer"].map((f) => (
                <div key={f}>
                  <p className="text-xs text-muted-foreground mb-1">{f}</p>
                  <div className="h-4 w-20 rounded bg-secondary"></div>
                </div>
              ))}
            </div>
          </div>

          {/* Sender Contact */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Customer Contact</h2>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <div className="h-4 w-32 rounded bg-secondary mb-1.5"></div>
                <div className="h-3.5 w-24 rounded bg-secondary"></div>
              </div>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4 mr-1.5" />Call
              </Button>
            </div>
          </div>

          {/* Actions */}
          <div className="flex gap-3">
            <Button className="flex-1" size="sm">
              <CheckCircle className="mr-1.5 h-4 w-4" />Mark as Delivered
            </Button>
            <Button variant="outline" size="sm" className="flex-1">
              <XCircle className="mr-1.5 h-4 w-4" />Report Issue
            </Button>
          </div>
        </div>

        <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
          <h2 className="text-sm font-semibold text-foreground mb-5">Progress</h2>
          <Timeline steps={timelineSteps} />
        </div>
      </div>
    </div>
  )
}
