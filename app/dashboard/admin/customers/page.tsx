import { adminGetCustomers } from "@/app/actions/delivery"
import { CustomersClient } from "./customers-client"

export default async function AdminCustomersPage() {
  const { data: rows = [] } = await adminGetCustomers()
  return <CustomersClient rows={rows} />
}
