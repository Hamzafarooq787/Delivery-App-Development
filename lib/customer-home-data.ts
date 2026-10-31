import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardUser } from '@/lib/dashboard-user'
import { getBfmSettings } from '@/app/actions/shopping'

export type CustomerHomeData = {
  profile: { id: string; name: string; email: string }
  balance: number | null
  delivery: { tracking_number: string | null; status: string | null } | null
  loadError: boolean
  shoppingEnabled: boolean | null
}

export async function getCustomerHomeData(): Promise<CustomerHomeData | null> {
  const user = await getDashboardUser()
  if (!user) return null
  const admin = createAdminClient()
  // Independent reads run together near the database, without client action queues.
  const [person, deliveries, wallet, settings] = await Promise.allSettled([
    admin.from('users').select('full_name').eq('id', user.id).maybeSingle(),
    admin.from('delivery_requests').select('tracking_number,status').eq('customer_id', user.id)
      .not('status', 'in', '("delivered","cancelled")').order('created_at', { ascending: false }).limit(1),
    admin.from('wallet_balances').select('balance').eq('user_id', user.id).maybeSingle(),
    getBfmSettings(),
  ])
  return {
    profile: { id: user.id, name: person.status === 'fulfilled' ? person.value.data?.full_name || '' : '', email: user.email || '' },
    delivery: deliveries.status === 'fulfilled' ? deliveries.value.data?.[0] ?? null : null,
    loadError: deliveries.status === 'rejected' || !!deliveries.value.error,
    balance: wallet.status === 'fulfilled' && !wallet.value.error ? Number(wallet.value.data?.balance ?? 0) : null,
    // An outage is unknown, not a disabled service. Booking rechecks live settings.
    shoppingEnabled: settings.status === 'fulfilled' ? settings.value.enabled : null,
  }
}
