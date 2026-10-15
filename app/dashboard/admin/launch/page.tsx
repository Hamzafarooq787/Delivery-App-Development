import { redirect } from 'next/navigation'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { LaunchOperationsPanel } from '@/components/admin/launch-operations-panel'
export default async function LaunchOperations() {
  const client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  if (!user) redirect('/login')
  const admin = createAdminClient(),
    { data: role } = await admin
      .from('users')
      .select('role')
      .eq('id', user.id)
      .single()
  if (role?.role !== 'admin') redirect('/dashboard/customer')
  const [orders, payments, earnings, payouts] = await Promise.all([
    admin
      .from('delivery_requests')
      .select(
        'id,tracking_number,status,service_type,receipt_url,shopping_started_at,purchase_confirmed_at,launch_quote',
      )
      .not('launch_quote', 'is', null)
      .order('created_at', { ascending: false })
      .limit(500),
    admin
      .from('payments')
      .select(
        'amount,service_amount,shopping_funds,processing_cost,refunded_amount,status',
      )
      .gt('service_amount', 0),
    admin
      .from('driver_earnings')
      .select('amount,commission_amount,subsidy_amount,status'),
    admin
      .from('payouts')
      .select('id,driver_id,amount,status,failure_reason,stripe_transfer_id')
      .order('created_at', { ascending: false })
      .limit(100),
  ])
  const money = (n: number) => `£${n.toFixed(2)}`
  const paid = (payments.data ?? []).filter((p) =>
    ['paid', 'released'].includes(p.status),
  )
  const sum = (
    field:
      | 'amount'
      | 'service_amount'
      | 'shopping_funds'
      | 'processing_cost'
      | 'refunded_amount',
  ) => paid.reduce((n, p) => n + Number(p[field] ?? 0), 0)
  return (
    <main className="p-5 text-white space-y-5">
      <h1 className="text-2xl font-bold">Launch payments and shopping</h1>
      {[orders, payments, earnings, payouts].some((r) => r.error) && (
        <p role="alert" className="text-orange-200">
          The launch database migration or query needs verification. Totals may
          be incomplete.
        </p>
      )}
      <div className="grid sm:grid-cols-3 gap-3">
        {[
          ['Customer payments', sum('amount')],
          ['Service fees', sum('service_amount')],
          ['Shopping purchase funds (not revenue)', sum('shopping_funds')],
          ['Refunds', sum('refunded_amount')],
          [
            'Recorded driver earnings',
            (earnings.data ?? []).reduce((n, e) => n + Number(e.amount), 0),
          ],
          [
            'Recorded commission',
            (earnings.data ?? []).reduce(
              (n, e) => n + Number(e.commission_amount ?? 0),
              0,
            ),
          ],
          [
            'Driver subsidies',
            (earnings.data ?? []).reduce(
              (n, e) => n + Number(e.subsidy_amount ?? 0),
              0,
            ),
          ],
        ].map(([label, value]) => (
          <div key={label as string} className="bg-[#242424] rounded-lg p-4">
            <p className="text-sm">{label}</p>
            <strong>{money(value as number)}</strong>
          </div>
        ))}
      </div>
      <p className="text-sm">
        Processing costs:{' '}
        {paid.some((p) => p.processing_cost == null)
          ? 'Pending Stripe reconciliation'
          : money(sum('processing_cost'))}
        . Commission is gross revenue before processing costs and subsidies.
      </p>
      <div className="flex gap-4">
        <Link href="/dashboard/admin/tracking">Live driver locations</Link>
        <Link href="/dashboard/admin/orders">
          All active, completed and cancelled orders
        </Link>
        <Link href="/dashboard/admin/settings">Pricing controls</Link>
      </div>
      <LaunchOperationsPanel />
      <h2 className="text-xl font-bold">
        Shopping receipts and completion times
      </h2>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr>
              <th>Order</th>
              <th>Status</th>
              <th>Shopping time</th>
              <th>Receipt</th>
            </tr>
          </thead>
          <tbody>
            {(orders.data ?? [])
              .filter((o) => o.service_type === 'buy_for_me')
              .map((o) => (
                <tr key={o.id} className="border-b border-gray-600">
                  <td className="p-3">
                    <Link href={`/dashboard/admin/orders/${o.id}`}>
                      {o.tracking_number}
                    </Link>
                  </td>
                  <td>{o.status}</td>
                  <td>
                    {o.shopping_started_at && o.purchase_confirmed_at
                      ? `${Math.round((Date.parse(o.purchase_confirmed_at) - Date.parse(o.shopping_started_at)) / 60000)} min`
                      : 'In progress / not started'}
                  </td>
                  <td>
                    {o.receipt_url ? (
                      <a href={o.receipt_url} target="_blank" rel="noreferrer">
                        View receipt
                      </a>
                    ) : (
                      'Not uploaded'
                    )}
                  </td>
                </tr>
              ))}
          </tbody>
        </table>
      </div>
      <h2 className="text-xl font-bold">Weekly payout batches</h2>
      {(payouts.data ?? []).map((p) => (
        <div key={p.id} className="bg-[#242424] p-3 rounded-lg">
          {p.driver_id} · {money(Number(p.amount))} · {p.status}
          {p.failure_reason && (
            <p className="text-orange-200">{p.failure_reason}</p>
          )}
        </div>
      ))}
    </main>
  )
}
