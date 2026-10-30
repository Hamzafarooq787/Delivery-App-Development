import { MapPin, Package, Clock, CheckCircle } from "lucide-react"
import { Button } from "@/components/ui/button"

export default async function TrackingPage({ params }: { params: Promise<{ trackingNumber: string }> }) {
  const { trackingNumber } = await params
  return (
    <div className="mx-auto max-w-3xl px-4 py-16 md:px-6">
      <div className="mb-8">
        <h1 className="text-2xl font-semibold text-foreground mb-2">Track Delivery</h1>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Package className="h-4 w-4" />
          <span>Tracking Number: <span className="font-mono font-medium text-foreground">{trackingNumber}</span></span>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm mb-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Status</p>
            <div className="flex items-center gap-2">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-secondary px-3 py-1 text-xs font-medium text-foreground">
                <span className="h-1.5 w-1.5 rounded-full bg-foreground"></span>
                Awaiting Data
              </span>
            </div>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground uppercase tracking-wide mb-1">Est. Delivery</p>
            <p className="text-sm font-medium text-foreground">—</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4 mb-6">
          {[
            { label: "Pickup Location", icon: MapPin },
            { label: "Drop-off Location", icon: MapPin },
          ].map((item) => (
            <div key={item.label} className="rounded-lg bg-secondary p-3">
              <div className="flex items-center gap-1.5 mb-1">
                <item.icon className="h-3.5 w-3.5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
              <div className="h-4 rounded bg-border"></div>
            </div>
          ))}
        </div>

        <div className="border-t border-border pt-5">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4">Delivery Timeline</p>
          <ol className="relative border-l border-border ml-3">
            {["Order Placed", "Driver Assigned", "Picked Up", "In Transit", "Delivered"].map((step, i) => (
              <li key={step} className="mb-5 ml-5">
                <span className="absolute -left-2.5 flex h-5 w-5 items-center justify-center rounded-full bg-secondary border border-border">
                  <span className="h-2 w-2 rounded-full bg-border"></span>
                </span>
                <p className="text-sm text-muted-foreground">{step}</p>
              </li>
            ))}
          </ol>
        </div>
      </div>

      <div className="rounded-xl border border-border bg-card p-6 shadow-sm text-center">
        <p className="text-sm text-muted-foreground mb-3">Enter a tracking number to view delivery status</p>
        <div className="flex gap-2 max-w-sm mx-auto">
          <input
            type="text"
            placeholder="Enter tracking number"
            className="flex-1 h-10 rounded-lg border border-border bg-background px-3 text-sm placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring"
          />
          <Button size="sm">Track</Button>
        </div>
      </div>
    </div>
  )
}
