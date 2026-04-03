import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Timeline } from "@/components/shared/timeline"
import { Button } from "@/components/ui/button"
import { ArrowLeft, MapPin, Package, User, Phone } from "lucide-react"
import Link from "next/link"

const timelineSteps = [
  { label: "Order Placed", description: "Your delivery was booked.", status: "completed" as const, time: "—" },
  { label: "Driver Assigned", description: "A driver has been matched.", status: "completed" as const, time: "—" },
  { label: "Picked Up", description: "Package collected from sender.", status: "active" as const, time: "—" },
  { label: "In Transit", description: "On the way to delivery address.", status: "upcoming" as const },
  { label: "Delivered", description: "Package delivered successfully.", status: "upcoming" as const },
]

export default function OrderDetailPage({ params }: { params: { orderId: string } }) {
  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-center gap-3">
        <Button variant="ghost" size="sm" asChild>
          <Link href="/customer/orders"><ArrowLeft className="h-4 w-4 mr-1" />Back</Link>
        </Button>
      </div>

      <PageHeader
        title={`Order ${params.orderId}`}
        description="Delivery details and live tracking"
      >
        <StatusBadge status="in_transit" />
      </PageHeader>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 flex flex-col gap-5">
          {/* Addresses */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Delivery Route</h2>
            <div className="flex flex-col gap-3">
              <div className="flex gap-3 items-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-foreground text-background shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Pickup</p>
                  <p className="text-sm font-medium text-foreground">Loading pickup address...</p>
                </div>
              </div>
              <div className="ml-4 border-l-2 border-dashed border-border h-4"></div>
              <div className="flex gap-3 items-start">
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-secondary text-foreground shrink-0">
                  <MapPin className="h-4 w-4" />
                </div>
                <div>
                  <p className="text-xs text-muted-foreground mb-0.5">Delivery</p>
                  <p className="text-sm font-medium text-foreground">Loading delivery address...</p>
                </div>
              </div>
            </div>
          </div>

          {/* Package Info */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Package Details</h2>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Package Type", value: "—" },
                { label: "Weight", value: "—" },
                { label: "Service", value: "—" },
                { label: "Total Amount", value: "—" },
                { label: "Tracking ID", value: params.orderId },
                { label: "Date", value: "—" },
              ].map((field) => (
                <div key={field.label}>
                  <p className="text-xs text-muted-foreground mb-1">{field.label}</p>
                  <p className="text-sm font-medium text-foreground">{field.value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Driver */}
          <div className="rounded-xl border border-border bg-card p-5 shadow-sm">
            <h2 className="text-sm font-semibold text-foreground mb-4">Assigned Driver</h2>
            <div className="flex items-center gap-4">
              <div className="h-12 w-12 rounded-full bg-secondary flex items-center justify-center">
                <User className="h-6 w-6 text-muted-foreground" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-medium text-foreground">Awaiting driver assignment</p>
                <p className="text-xs text-muted-foreground">Driver details will appear here once assigned</p>
              </div>
              <Button variant="outline" size="sm">
                <Phone className="h-4 w-4 mr-1.5" />Contact
              </Button>
            </div>
          </div>
        </div>

        {/* Timeline */}
        <div className="rounded-xl border border-border bg-card p-5 shadow-sm h-fit">
          <h2 className="text-sm font-semibold text-foreground mb-5">Delivery Progress</h2>
          <Timeline steps={timelineSteps} />
        </div>
      </div>
    </div>
  )
}
