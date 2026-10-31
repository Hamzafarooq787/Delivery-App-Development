import {SupportContact} from "@/components/support-contact"
import { getDriverTickets } from "@/app/actions/driver"
import { SupportPanel } from "@/components/driver/support-panel"

export const dynamic = "force-dynamic"

export default async function DriverSupportPage() {
  const { data: tickets,count,error } = await getDriverTickets()

  if(error)throw new Error(error)
  return <><SupportContact/><SupportPanel initialTickets={tickets} initialCount={count} /></>
}
