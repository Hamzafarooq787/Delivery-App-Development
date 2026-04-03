import { createClient } from "@/lib/supabase/server"
import { StatCard } from "@/components/shared/stat-card"
import { PageHeader } from "@/components/shared/page-header"
import { StatusBadge } from "@/components/shared/status-badge"
import { Button } from "@/components/ui/button"
import { Briefcase, DollarSign, Star, Clock } from "lucide-react"
import Link from "next/link"

export default async function DriverDashboard() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [jobsRes, earningsRes] = await Promise.all([
    supabase
      .from("delivery_requests")
      .select("*")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("driver_earnings")
      .select("amount")
      .eq("driver_id", user?.id ?? ""),
  ])

  const jobs = jobsRes.data ?? []
  const totalEarnings = earningsRes.data?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0
  const activeJobs = jobs.filter((j) => ["accepted", "picked_up", "in_transit"].includes(j.status)).length
  const recentJobs = jobs.slice(0, 5)

  return (
    <div className="flex flex-col gap-6">
      <PageHeader title="Driver Dashboard" description="Your delivery performance at a glance." />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Total Jobs" icon={Briefcase} value={String(jobs.length)} description="All time" />
        <StatCard title="Active Jobs" icon={Clock} value={String(activeJobs)} description="In progress" />
        <StatCard title="Total Earnings" icon={DollarSign} value={`$${totalEarnings.toFixed(2)}`} description="All time" />
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
            <Link href="/driver/jobs/active">View all</Link>
          </Button>
        </div>
        {recentJobs.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-center">
            <Briefcase className="h-8 w-8 text-muted-foreground/40 mb-3" />
            <p className="text-sm font-medium text-foreground">No jobs yet</p>
            <p className="text-xs text-muted-foreground mt-1 mb-4">Browse available jobs to get started.</p>
            <Button size="sm" asChild>
              <Link href="/driver/jobs/available">Browse Jobs</Link>
            </Button>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-border">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Tracking #</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Pickup</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Delivery</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Status</th>
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted-foreground">Date</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody>
                {recentJobs.map((job) => (
                  <tr key={job.id} className="border-b border-border last:border-0 hover:bg-secondary/20 transition-colors">
                    <td className="px-5 py-3.5 text-sm font-mono font-medium text-foreground">{job.tracking_number}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[140px] truncate">{job.pickup_address}</td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground max-w-[140px] truncate">{job.delivery_address}</td>
                    <td className="px-5 py-3.5"><StatusBadge status={job.status} /></td>
                    <td className="px-5 py-3.5 text-sm text-muted-foreground whitespace-nowrap">
                      {new Date(job.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3.5">
                      <Button variant="ghost" size="sm" asChild>
                        <Link href={`/driver/jobs/active`}>View</Link>
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}
