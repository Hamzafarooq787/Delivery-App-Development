import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Briefcase, DollarSign, Star, Clock } from "lucide-react"
import Link from "next/link"

const recentJobs = [
  { id: "JOB-001", from: "—", to: "—", status: "completed" as const, earnings: "—" },
  { id: "JOB-002", from: "—", to: "—", status: "completed" as const, earnings: "—" },
  { id: "JOB-003", from: "—", to: "—", status: "active" as const, earnings: "—" },
]

export default function DriverDashboard() {
  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Driver Dashboard" description="Your delivery performance at a glance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Jobs" icon={Briefcase} value="—" description="All time" />
        <StatCard title="Active Job" icon={Clock} value="—" description="In progress" />
        <StatCard title="Total Earnings" icon={DollarSign} value="—" description="All time" />
        <StatCard title="Rating" icon={Star} value="—" description="Average" />
      </div>

      {/* Online toggle */}
      <div className="flex items-center justify-between rounded-xl border border-border bg-card px-5 py-4 shadow-sm">
        <div>
          <p className="text-sm font-semibold text-foreground">Availability Status</p>
          <p className="text-xs text-muted-foreground">Toggle to accept new delivery jobs</p>
        </div>
        <button
          className="relative inline-flex h-6 w-11 shrink-0 rounded-full border-2 border-transparent bg-secondary transition-colors"
          role="switch"
          aria-checked="false"
        >
          <span className="pointer-events-none inline-block h-5 w-5 rounded-full bg-background shadow transform transition-transform translate-x-0" />
        </button>
      </div>

      <div className="rounded-xl border border-border bg-card shadow-sm">
        <div className="flex items-center justify-between px-5 py-4 border-b border-border">
          <h2 className="text-sm font-semibold text-foreground">Recent Jobs</h2>
          <Button variant="ghost" size="sm" asChild>
            <Link href="/driver/jobs">View all</Link>
          </Button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Job ID</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Pickup</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Delivery</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Earnings</th>
                <th className="px-5 py-3"></th>
              </tr>
            </thead>
            <tbody>
              {recentJobs.map((job) => (
                <tr key={job.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                  <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">{job.id}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{job.from}</td>
                  <td className="px-5 py-3.5 text-sm text-muted-foreground">{job.to}</td>
                  <td className="px-5 py-3.5"><StatusBadge status={job.status} /></td>
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
