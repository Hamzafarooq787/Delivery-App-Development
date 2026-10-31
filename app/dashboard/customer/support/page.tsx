import {SupportContact} from "@/components/support-contact"
import { getMyTickets } from '@/app/actions/driver'
import CustomerSupport from '@/components/customer/CustomerSupport'
export const dynamic = 'force-dynamic'
export default async function CustomerSupportPage() {
  const result = await getMyTickets()
  return (
    <CustomerSupport initialTickets={result.data} initialError={result.error} contactDetails={<SupportContact showName={false} />} />
  )
}
