import { adminGetCustomers } from "@/app/actions/delivery"
import { CustomersClient } from "./customers-client"

export default async function AdminCustomersPage() {
  const { data: rows = [], error } = await adminGetCustomers()
  if (error) throw new Error("Customer records could not load. Please retry.")
  return <CustomersClient rows={rows} />
}
