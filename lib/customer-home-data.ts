import 'server-only'
import { createAdminClient } from '@/lib/supabase/admin'
import { getDashboardUser } from '@/lib/dashboard-user'
import {normaliseOperations,openingError} from '@/lib/admin-operations'
import { getBfmSettings } from '@/app/actions/shopping'

export type CustomerHomeData = {
  profile: { id: string; name: string; email: string }
  balance: number | null
  delivery: { tracking_number: string | null; status: string | null } | null
  loadError: boolean
  deliveryEnabled?:boolean|null
  deliveryReason?:string|null
  shoppingReason?:string|null
  shoppingEnabled: boolean | null
}

export async function getCustomerHomeData(): Promise<CustomerHomeData | null> {
  const user = await getDashboardUser()
  if (!user) return null
  const admin = createAdminClient()
  // Independent reads run together near the database, without client action queues.
  const [person, deliveries, wallet, settings,operations] = await Promise.allSettled([
    admin.from('users').select('full_name').eq('id', user.id).maybeSingle(),
    admin.from('delivery_requests').select('tracking_number,status').eq('customer_id', user.id)
      .not('status', 'in', '("delivered","cancelled")').order('created_at', { ascending: false }).limit(1),
    admin.from('wallet_balances').select('balance').eq('user_id', user.id).maybeSingle(),
    getBfmSettings(),
    admin.from('surge_pricing_settings').select('operational_settings').eq('id',true).maybeSingle(),
  ])
  let deliveryReason:string|null=null,shoppingReason:string|null=null,known=false
  if(operations.status==='fulfilled'&&!operations.value.error&&operations.value.data)try{const ops=normaliseOperations(operations.value.data.operational_settings);deliveryReason=openingError(ops,'delivery');shoppingReason=openingError(ops,'buy_for_me');known=true}catch{/* Unknown availability remains separate from a deliberately paused service. */}
  return {
    deliveryEnabled:known?!deliveryReason:null,deliveryReason,shoppingReason,
    profile: { id: user.id, name: person.status === 'fulfilled' ? person.value.data?.full_name || '' : '', email: user.email || '' },
    delivery: deliveries.status === 'fulfilled' ? deliveries.value.data?.[0] ?? null : null,
    loadError: deliveries.status === 'rejected' || !!deliveries.value.error,
    balance: wallet.status === 'fulfilled' && !wallet.value.error ? Number(wallet.value.data?.balance ?? 0) : null,
    // An outage is unknown, not a disabled service. Booking rechecks live settings.
    shoppingEnabled: settings.status==='fulfilled'&&!settings.value.enabled?false:known&&shoppingReason?false:settings.status==='fulfilled'&&known?true:null,
  }
}
