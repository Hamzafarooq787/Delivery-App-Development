import { createClient } from "@/lib/supabase/server"
import { getAdminActor } from "@/lib/admin-access"
import { boundedFetch } from "@/lib/short-request"

const active=["accepted","collected","picked_up","in_transit"]
export async function GET(request:Request) {
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}})
 const db=await createClient(boundedFetch(4500))
 const {data,error}=await db.auth.getClaims()
 const user=data?.claims.sub
 if(!user)return reply({},error?.name==="AuthRetryableFetchError"?503:401)
 const id=new URL(request.url).searchParams.get("id")
 if(!id){
  const jobs=await db.from("delivery_requests").select("id").eq("driver_id",user).in("status",active).order("created_at").limit(20)
  return jobs.error?reply({},503):reply({jobs:jobs.data})
 }
 if(!/^[0-9a-f-]{36}$/i.test(id))return reply({},400)
 const order=await db.from("delivery_requests").select("driver_id,customer_id").eq("id",id).in("status",active).maybeSingle()
 if(order.error)return reply({},503)
 if(!order.data||(![order.data.driver_id,order.data.customer_id].includes(user)&&!await getAdminActor("operations")))return reply({},404)
 const [driver,customer]=await Promise.all([
  order.data.driver_id ? db.from("driver_locations").select("lat,lng,delivery_id,updated_at").eq("driver_id",order.data.driver_id).eq("delivery_id",id).maybeSingle() : {data:null,error:null},
  db.from("customer_locations").select("lat,lng,delivery_id,updated_at").eq("customer_id",order.data.customer_id).eq("delivery_id",id).maybeSingle(),
 ])
 return reply({driver:driver.data,customer:customer.data},driver.error||customer.error?503:200)
}
