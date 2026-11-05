import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch } from "@/lib/short-request"
const columns='id,tracking_number,status,pickup_address,delivery_address,driver_id,created_at,pickup_lat,pickup_lng,delivery_lat,delivery_lng,parcel_image_url,delivered_image_url,item_description,item_photo_urls,price,base_price,surge_multiplier,discount_amount,promo_code,service_type,bfm_stage,cancellation_outcome'
export async function GET(request:Request) {
 const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}})
 const db=await createClient(boundedFetch(5000))
 const {data:auth,error}=await db.auth.getClaims()
 const user=auth?.claims.sub
 if(!user)return reply({},error?.name==="AuthRetryableFetchError"?503:401)
 const id=new URL(request.url).searchParams.get("id")
 if(id&&!/^[0-9a-f-]{36}$/i.test(id))return reply({},400)
 const q=db.from("delivery_requests").select(columns).eq("customer_id",user)
 const order=await (id?q.eq("id",id):q.in("status",["requested","accepted","collected","picked_up","in_transit","delivered"]).order("created_at",{ascending:false}).limit(1)).maybeSingle()
 if(order.error)return reply({},503)
 if(!order.data)return reply({user,order:null})
 const admin=createAdminClient(boundedFetch(4000))
 const idDriver=order.data.status==="cancelled"?null:order.data.driver_id
 const [logs,driver,vehicle,rating]=await Promise.all([
  db.from("delivery_status_logs").select("status,created_at,occurred_at_known").eq("delivery_id",order.data.id).order("created_at"),
  idDriver?admin.from("users").select("full_name").eq("id",idDriver).maybeSingle():{data:null},
  idDriver?admin.from("driver_vehicles").select("vehicle_type,make,model,colour").eq("driver_id",idDriver).order("created_at").limit(1).maybeSingle():{data:null},
  idDriver?admin.rpc("approved_rating_summary",{p_user:idDriver}):{data:null},
 ])
 return reply({user,order:order.data,logs:logs.data??[],driver:driver.data?{...driver.data,vehicle:vehicle.data}:null,rating:rating.data??{average:null,count:0}})
}
