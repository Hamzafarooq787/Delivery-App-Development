import {SupportContact} from "@/components/support-contact"
import { getMyTickets } from '@/app/actions/driver'
import CustomerSupport from '@/components/customer/CustomerSupport'
export const dynamic = 'force-dynamic'
export default async function CustomerSupportPage() {
  const result = await getMyTickets()
  return (
    <CustomerSupport initialTickets={result.data} initialError={result.error} contactDetails={<section className="mb-5 space-y-3 text-white"><h2 className="font-bold">Frequently asked questions</h2><details><summary>Where is my order?</summary><p>Open Shipments and select the order to see its latest status.</p></details><details><summary>How do I cancel a booking?</summary><p>Open the order in Tracking. If cancellation is available, you’ll see a Cancel order button.</p></details><details><summary>Where can I check my refund?</summary><p>Open Payments and choose Refunds to see the status.</p></details><SupportContact showName={false} /></section>} />
  )
}
