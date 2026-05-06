import { getMyTickets } from "@/app/actions/driver"
import { SupportPanel } from "@/components/driver/support-panel"

export const dynamic = "force-dynamic"

export default async function DriverSupportPage() {
  const { data: tickets } = await getMyTickets()

  return <SupportPanel initialTickets={tickets} />
}
