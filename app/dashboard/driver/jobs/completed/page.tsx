import { getDriverDeliveries } from "@/app/actions/delivery"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleDateString(undefined, {
      month: "short",
      day: "numeric",
      year: "numeric",
    })
  } catch {
    return value
  }
}

function formatPrice(value: number | null) {
  if (value == null) return "—"
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value)
}

export default async function CompletedJobsPage() {
  const { data: jobs, error } = await getDriverDeliveries("delivered")

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-2xl font-bold">Completed Jobs</h1>
        <p className="text-muted-foreground text-sm mt-1">Your delivery history.</p>
      </div>

      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
          Failed to load completed jobs: {error}
        </div>
      )}

      {!error && jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-card px-6 py-16 text-center">
          <p className="text-base font-semibold text-foreground">No completed jobs yet</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Completed deliveries will appear here.
          </p>
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border bg-secondary/30">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Tracking #</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Pickup</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Delivery</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Payout</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {jobs.map((job: any) => (
                  <tr key={job.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">
                      {job.tracking_number || job.id.slice(0, 8)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground">
                      {formatDate(job.created_at)}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[160px] truncate">
                      {job.pickup_address || "—"}
                    </td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[160px] truncate">
                      {job.delivery_address || "—"}
                    </td>
                    <td className="px-5 py-3.5">
                      <StatusBadge status="completed" />
                    </td>
                    <td className="px-5 py-3.5 text-sm text-foreground">
                      {formatPrice(job.price)}
                    </td>
                    <td className="px-5 py-3.5">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/dashboard/driver/jobs/${job.id}`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
