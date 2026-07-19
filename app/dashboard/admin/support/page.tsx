import { adminGetSupportTickets } from "@/app/actions/support"
import { SupportTicketsPanel } from "@/components/admin/support-tickets-panel"

export const dynamic = "force-dynamic"

export default async function AdminSupportPage() {
  const { data: tickets } = await adminGetSupportTickets()

  return <SupportTicketsPanel initialTickets={tickets} />
}
