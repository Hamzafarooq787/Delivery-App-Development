import "server-only"
import { createAdminClient } from "@/lib/supabase/admin"
export function validDeviceToken(token: unknown): token is string {
  return typeof token === "string" && token.length >= 10 && token.length <= 4096 && !/\s|[\x00-\x1f\x7f]/.test(token)
}
export async function claimDevice(userId: string, token: unknown, deviceType: unknown = "web") {
  if (!validDeviceToken(token) || !["web","mobile","desktop"].includes(String(deviceType))) return {error:"Invalid device registration"}
  const {error} = await createAdminClient().rpc("claim_notification_device",{p_user:userId,p_token:token,p_device:deviceType})
  return error ? {error:"Could not register notifications. Please retry."} : {success:true}
}
