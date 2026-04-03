import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import Link from "next/link"

const completedJobs = [
  { id: "JOB-001", date: "—", pickup: "—", delivery: "—", earnings: "—" },
  { id: "JOB-002", date: "—", pickup: "—", delivery: "—", earnings: "—" },
  { id: "JOB-003", date: "—", pickup: "—", delivery: "—", earnings: "—" },
]

export default function CompletedJobsPage() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Completed Jobs" description="Your delivery history." />

      <div className="rounded-xl border border-border bg-card shadow-sm overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border bg-secondary/30">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Job ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Pickup</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Delivery</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Earnings</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {completedJobs.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">{job.id}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{job.date}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{job.pickup}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{job.delivery}</td>
                  <td className="px-5 py-3.5"><StatusBadge status="completed" /></td>
                  <td className="px-5 py-3.5 text-sm text-foreground">{job.earnings}</td>
                  <td className="px-5 py-3.5">
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/driver/jobs/${job.id}`}>View</Link>
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}
