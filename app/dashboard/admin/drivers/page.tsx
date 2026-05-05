import { adminGetDrivers } from "@/app/actions/delivery"
import { DriversPanel } from "@/components/admin/drivers-panel"

export default async function AdminDriversPage() {
  const { data: drivers } = await adminGetDrivers()

  return <DriversPanel drivers={drivers ?? []} />
}
