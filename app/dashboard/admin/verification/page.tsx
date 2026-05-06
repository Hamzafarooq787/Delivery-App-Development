import { adminGetPendingVerifications } from "@/app/actions/delivery"
import { VerificationRequestsPanel } from "@/components/admin/verification-requests-panel"

export const dynamic = "force-dynamic"

export default async function VerificationRequestsPage() {
  const { data: drivers } = await adminGetPendingVerifications()

  return <VerificationRequestsPanel initialDrivers={drivers} />
}
