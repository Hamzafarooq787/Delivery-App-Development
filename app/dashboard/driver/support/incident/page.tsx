import { getDashboardUser } from "@/lib/dashboard-user"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch } from "@/lib/short-request"
import { DriverIncidentForm } from "@/components/driver/driver-incident-form"

export default async function DriverIncidentPage(){
 const user=await getDashboardUser()
 if(!user)return null
 const {data,error}=await createAdminClient(boundedFetch(3500)).from("delivery_requests").select("id,tracking_number").eq("driver_id",user.id).order("created_at",{ascending:false}).limit(50)
 return <DriverIncidentForm jobs={data??[]} jobsUnavailable={!!error}/>
}
