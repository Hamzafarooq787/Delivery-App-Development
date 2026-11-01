import "server-only"

import { createAdminClient } from "@/lib/supabase/admin"
import { isPackageSize, VEHICLE_CAPABILITIES, type VehicleType } from "@/lib/vehicles"
import {
  sendPushNotification,
  sendPushNotificationToMultipleUsers,
} from "@/lib/notifications/send"
import type { MulticastResult, UserNotificationResult } from "@/lib/notifications/types"

// ── Notification senders ──────────────────────────────────────────────────────

/**
 * Send a push notification to a specific user by their Supabase user ID.
 * Call this from any server action that needs to trigger a push.
 *
 * @example
 * // In delivery.ts — when a driver accepts a job, notify the customer:
 * await notifyUser({
 *   userId: delivery.customer_id,
 *   title: "Driver on the way!",
 *   body: "Your delivery has been accepted and the driver is heading to you.",
 *   url: `/dashboard/customer`,
 *   tag: "delivery-accepted",
 * })
 */
export async function notifyUser({
  userId,
  title,
  body,
  url = "/",
  tag,
  data,
}: {
  userId: string
  title: string
  body: string
  url?: string
  tag?: string
  data?: Record<string, string>
}): Promise<MulticastResult> {
  try {
    return await sendPushNotification({
      userId,
      notification: { title, body, url, tag, data },
    })
  } catch (error) {
    console.error("[Actions/notifications] notifyUser:", error)
    return { successCount: 0, failureCount: 0, failedTokens: [] }
  }
}

/**
 * Notify all approved, online drivers about a newly created delivery whose
 * vehicle(s) can carry it. Called from createDeliveryRequest() after insert.
 *
 * @param deliveryId    UUID of the newly inserted delivery_requests row
 * @param pickupAddress Human-readable pickup address (truncated to 60 chars in body)
 * @param packageSize   The delivery's package size — drivers are only
 *   notified if at least one of their registered vehicles can carry it.
 *   Omit/null for legacy deliveries with no size (notifies everyone, as before).
 */
export async function notifyDriversOfNewDelivery(
  deliveryId: string,
  pickupAddress: string,
  packageSize?: string | null
): Promise<void> {
  try {
    const admin = createAdminClient()
    const {data:eligible,error}=await admin.rpc('eligible_delivery_drivers',{p_id:deliveryId})
    if(error)throw error
    const driverIds:string[]=eligible??[]
    if (driverIds.length === 0) {
      console.log("[Notify] notifyDriversOfNewDelivery: no online drivers with a matching vehicle")
      return
    }

    console.log(`[Notify] notifyDriversOfNewDelivery: notifying ${driverIds.length} driver(s) for delivery ${deliveryId}`)

    await sendPushNotificationToMultipleUsers({
      userIds: driverIds,
      notification: {
        title: "📦 New delivery available!",
        body: `Pickup: ${pickupAddress.slice(0, 60)}`,
        url: `/dashboard/driver/jobs/available?job=${deliveryId}`,
        tag: `new-delivery-${deliveryId}`,
        data: { deliveryId },
      },
    })
  } catch (error) {
    console.error("[Notify] notifyDriversOfNewDelivery failed:", error)
  }
}

/**
 * Broadcast a push notification to multiple users at once.
 * Useful for notifying all available drivers about a new order.
 *
 * @example
 * const onlineDriverIds = drivers.map(d => d.id)
 * await notifyMultipleUsers({
 *   userIds: onlineDriverIds,
 *   title: "New delivery available!",
 *   body: "Open the app to accept.",
 *   url: `/dashboard/driver/jobs/available?job=${deliveryId}`,
 *   tag: "new-delivery",
 * })
 */
export async function notifyMultipleUsers({
  userIds,
  title,
  body,
  url = "/",
  tag,
  data,
}: {
  userIds: string[]
  title: string
  body: string
  url?: string
  tag?: string
  data?: Record<string, string>
}): Promise<UserNotificationResult[]> {
  try {
    return await sendPushNotificationToMultipleUsers({
      userIds,
      notification: { title, body, url, tag, data },
    })
  } catch (error) {
    console.error("[Actions/notifications] notifyMultipleUsers:", error)
    return []
  }
}

/** Push is a supplement to the transactional in-app support notice. */
export async function notifySupportUpdate(ticketId:string,senderId:string,key:string){
 const db=createAdminClient();const [ticket,sender]=await Promise.all([db.from('support_tickets').select('user_id').eq('id',ticketId).maybeSingle(),db.from('users').select('role').eq('id',senderId).maybeSingle()]);if(!ticket.data||!sender.data)return
 if(sender.data.role==='admin'){const recipient=await db.from('users').select('role').eq('id',ticket.data.user_id).maybeSingle();await notifyUser({userId:ticket.data.user_id,title:'Support Reply',body:'A reply is waiting in your support request.',url:`/dashboard/${recipient.data?.role==='driver'?'driver':'customer'}/support?ticket=${ticketId}`,tag:`support-${key}`})}
 else {const staff=await db.from('users').select('id,admin_access').eq('role','admin').eq('account_status','active');const ids=(staff.data??[]).filter(u=>u.admin_access?.owner||u.admin_access?.scopes?.includes('support')).map(u=>u.id);await notifyMultipleUsers({userIds:ids,title:'Support request update',body:'A customer or driver needs a support response.',url:`/dashboard/admin/support?ticket=${ticketId}`,tag:`support-${key}`})}
}
