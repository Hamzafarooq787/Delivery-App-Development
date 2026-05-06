import { getAvailableDeliveries } from "@/app/actions/delivery"
import { AvailableJobsPanel } from "@/components/driver/available-jobs-panel"

export const dynamic = "force-dynamic"

export default async function AvailableJobsPage() {
  const { data: jobs } = await getAvailableDeliveries()

  return <AvailableJobsPanel jobs={jobs as any[]} />
}
