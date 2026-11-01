import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { sendPushNotification } from "@/lib/notifications/send"

// Public callers may only test their own device. Operational notifications use
// verified server workflows; marketing uses the scoped, consent-aware admin action.
export async function POST(req: NextRequest) {
  const session = await createClient()
  const {data:{user},error} = await session.auth.getUser()
  if(error || !user) return NextResponse.json({error:"Unauthorized"},{status:401})
  let body
  try { body = await req.json() } catch { return NextResponse.json({error:"Invalid JSON"},{status:400}) }
  if(!body || body.test !== true || body.userId && body.userId !== user.id) return NextResponse.json({error:"Only a self-addressed test is allowed"},{status:403})
  const db = createAdminClient()
  const {data:allowed,error:limitError} = await db.rpc("claim_push_test",{p_user:user.id})
  if(limitError) return NextResponse.json({error:"Notification service unavailable"},{status:503})
  if(!allowed) return NextResponse.json({error:"Please wait one minute before testing again."},{status:429,headers:{"Retry-After":"60"}})
  try {
    const result = await sendPushNotification({userId:user.id,notification:{title:"GoDrop test notification",body:"Notifications are connected on this device.",url:"/dashboard",tag:"device-test"}})
    return NextResponse.json(result)
  } catch { return NextResponse.json({error:"Notification service unavailable"},{status:503}) }
}
