import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { getAvailableDeliveries } from '@/app/actions/delivery'
import {
  MapFirstDashboard,
  type DashboardJob,
} from '@/components/driver/MapFirstDashboard'

export const dynamic = 'force-dynamic'

export default async function DriverDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const admin = createAdminClient()
  const { data: profile } = await admin
    .from('driver_profiles')
    .select('status, is_online')
    .eq('id', user.id)
    .maybeSingle()
  // The layout shows onboarding for unapproved accounts. Do not fetch offers for them.
  if (profile?.status !== 'approved') return null
  const [available, assigned, earnings] = await Promise.all([
    getAvailableDeliveries(),
    supabase
      .from('delivery_requests')
      .select(
        'id,status,pickup_address,delivery_address,item_description,price,package_size,service_type,shop_name,created_at',
      )
      .eq('driver_id', user.id)
      .order('created_at', { ascending: false }),
    supabase
      .from('driver_earnings')
      .select('amount,created_at,delivery_id')
      .eq('driver_id', user.id),
  ])
  const jobs = assigned.data ?? []
  const recorded = earnings.data ?? []
  const covered = new Set(recorded.map((e) => e.delivery_id))
  // Preserve the deployed earnings fallback and current rates.
  const merged = [
    ...recorded,
    ...jobs
      .filter(
        (j) =>
          j.status === 'delivered' && !covered.has(j.id) && j.price != null,
      )
      .map((j) => ({
        amount: Math.round(Number(j.price) * 0.75 * 100) / 100,
        created_at: j.created_at,
        delivery_id: j.id,
      })),
  ]
  const day = new Intl.DateTimeFormat('en-GB', { timeZone: 'Europe/London' })
  const today = day.format(new Date())
  const todayRows = merged.filter(
    (e) => day.format(new Date(e.created_at)) === today,
  )
  const activeStatuses = ['accepted', 'collected', 'picked_up', 'in_transit']
  return (
    <MapFirstDashboard
      jobs={(available.data ?? []) as DashboardJob[]}
      activeJobs={
        jobs.filter((j) => activeStatuses.includes(j.status)) as DashboardJob[]
      }
      todayEarnings={todayRows.reduce(
        (sum, e) => sum + Number(e.amount ?? 0),
        0,
      )}
      completedToday={new Set(todayRows.map((e) => e.delivery_id)).size}
      initialOnline={profile.is_online ?? false}
      dataError={
        available.error || assigned.error?.message || earnings.error?.message
      }
    />
  )
}
