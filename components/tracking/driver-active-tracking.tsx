'use client'
import { useEffect, useMemo, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { DriverLocationBroadcaster } from './driver-location-broadcaster'
import { useDriverTrackingSelection } from './driver-tracking-selection'
export function DriverActiveTracking({ userId }: { userId: string }) {
  const client = useMemo(() => createClient(), [])
  const path = usePathname()
  const { deliveryId: selectedDeliveryId } = useDriverTrackingSelection()
  const [jobId, setJobId] = useState<string | null>(null)
  useEffect(() => {
    if (!userId) return
    let alive = true
    let sequence=0
    const refresh = async () => {
      const request=++sequence
      const { data, error } = await client.from('delivery_requests').select('id').eq('driver_id', userId).in('status', ['accepted', 'collected', 'picked_up', 'in_transit']).order('created_at').limit(20)
      if (!alive||request!==sequence) return
      if (error) return // Keep the current watch during transient connectivity loss.
      // Existing multi-job assignments remain accessible. Track the displayed job,
      // but validate any UI selection against the driver's actual active rows.
      setJobId(data?.find(job => path.includes(job.id))?.id ??
        data?.find(job => job.id === selectedDeliveryId)?.id ?? data?.[0]?.id ?? null)
    }
    void refresh()
    const channel = client.channel(`active-driver-tracking-${userId}`).on('postgres_changes', { event: '*', schema: 'public', table: 'delivery_requests', filter: `driver_id=eq.${userId}` }, () => { void refresh() }).subscribe()
    const timer = setInterval(() => { void refresh() }, 15000)
    return () => { alive = false; clearInterval(timer); void client.removeChannel(channel) }
  }, [client, userId, path, selectedDeliveryId])
  return jobId ? <div className="fixed bottom-20 right-3 z-40"><DriverLocationBroadcaster deliveryId={jobId} /></div> : null
}
