import { adminGetDrivers } from "@/app/actions/delivery"
import { DriversPanel } from "@/components/admin/drivers-panel"

export default async function AdminDriversPage() {
  const { data: drivers, error } = await adminGetDrivers()

  if (error) throw new Error("Driver records could not load. Please retry.")
  return <DriversPanel drivers={drivers ?? []} />
}
