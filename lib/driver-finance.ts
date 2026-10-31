export type DriverFinanceRow = {
  id: string
  amount: number
  commission_amount?: number
  status: string
  created_at: string
  payment_reference?: string | null
  provider?: { error?: string } | null
  delivery_requests?: { tracking_number?: string | null; price?: number | null }
}
export type DriverFinanceSnapshot = {
  totals: { available: number; total: number; today: number; today_jobs: number; jobs: number }
  paid: number
  count: number
  rows: DriverFinanceRow[]
}
