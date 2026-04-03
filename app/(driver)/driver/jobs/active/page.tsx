import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Package } from "lucide-react"

export default function ActiveJobsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Active Jobs" description="Your currently in-progress deliveries." />

      <div className="rounded-xl border border-dashed border-border bg-card p-12 text-center shadow-sm">
        <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary mx-auto mb-4">
          <Package className="h-6 w-6 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium text-foreground mb-1">No Active Jobs</p>
        <p className="text-sm text-muted-foreground mb-4">You have no deliveries in progress right now.</p>
        <Button size="sm" asChild>
          <Link href="/driver/jobs/available">Browse Available Jobs</Link>
        </Button>
      </div>
    </div>
  )
}
