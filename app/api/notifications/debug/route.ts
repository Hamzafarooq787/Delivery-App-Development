import { NextRequest, NextResponse } from "next/server"
import { getAdminActor } from "@/lib/admin-access"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(req: NextRequest) {
  const actor = await getAdminActor("settings")
  if(!actor) return NextResponse.json({error:"Forbidden"},{status:403})
  if(req.nextUrl.searchParams.has("purge") || req.nextUrl.searchParams.has("send")) return NextResponse.json({error:"GET diagnostics are read-only. Use notification controls to make changes."},{status:405,headers:{Allow:"GET"}})
  const {count,error} = await createAdminClient().from("user_notification_tokens").select("id",{count:"exact",head:true}).eq("user_id",actor.id)
  if(error) return NextResponse.json({error:"Diagnostics unavailable"},{status:503})
  return NextResponse.json({tokenCount:count ?? 0,configured:Boolean(process.env.FIREBASE_ADMIN_PROJECT_ID && process.env.FIREBASE_ADMIN_CLIENT_EMAIL && process.env.FIREBASE_ADMIN_PRIVATE_KEY)},{headers:{"Cache-Control":"no-store"}})
}
