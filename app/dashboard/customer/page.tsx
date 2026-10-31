import CustomerHome from '@/components/customer/CustomerHome'
import { getCustomerHomeData } from '@/lib/customer-home-data'
import { redirect } from 'next/navigation'

export default async function CustomerPage() {
  const initialData = await getCustomerHomeData()
  if (!initialData) redirect('/login')
  return <CustomerHome initialData={initialData} />
}
