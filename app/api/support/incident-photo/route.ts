import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getAdminActor } from "@/lib/admin-access"
import { boundedFetch } from "@/lib/short-request"

export async function GET(request:Request){
 const id=new URL(request.url).searchParams.get("id")??""
 if(!/^[a-f0-9-]{36}$/i.test(id))return new Response(null,{status:404})
 const db=await createClient(boundedFetch(3500))
 const {data:{user}}=await db.auth.getUser()
 if(!user)return new Response(null,{status:401})
 const admin=createAdminClient(boundedFetch(5000))
 const {data:ticket}=await admin.from("support_tickets").select("user_id,incident_photo_key").eq("id",id).maybeSingle()
 if(!ticket || ticket.user_id!==user.id && !(await getAdminActor("support")))return new Response(null,{status:404})
 if(ticket.incident_photo_key!==`${ticket.user_id}/${id}.jpg`)return new Response(null,{status:404})
 const {data,error}=await admin.storage.from("incident-evidence").download(ticket.incident_photo_key)
 if(error)return new Response(null,{status:503})
 return new Response(data,{headers:{"Content-Type":"image/jpeg","Cache-Control":"private, no-store","X-Content-Type-Options":"nosniff"}})
}
