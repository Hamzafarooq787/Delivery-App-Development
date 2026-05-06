import { getDriverDeliveries } from "@/app/actions/delivery"
import { CompletedJobsPanel } from "@/components/driver/completed-jobs-panel"

export const dynamic = "force-dynamic"

export default async function CompletedJobsPage() {
  const { data: jobs } = await getDriverDeliveries("delivered")

  return <CompletedJobsPanel jobs={jobs as any[]} />
}
