import { getAvailableDeliveries } from "@/app/actions/delivery"
import { AvailableJobsPanel } from "@/components/driver/available-jobs-panel"
import Link from "next/link"

export const dynamic = "force-dynamic"

export default async function AvailableJobsPage() {
  const { data: jobs, error } = await getAvailableDeliveries()
  if (error) return <section className="p-5 text-white" role="status">
    <h1 className="mb-3 text-2xl font-bold">Available Jobs</h1>
    <p>{error}</p>
    <Link className="mt-4 inline-block text-[var(--brand-soft)] underline" href="/dashboard/driver/active-jobs">View active deliveries</Link>
  </section>

  return <AvailableJobsPanel jobs={jobs as any[]} />
}
