import {createClient} from '@/lib/supabase/server'
import {createAdminClient} from '@/lib/supabase/admin'
import {getAvailableDeliveries} from '@/app/actions/delivery'
import {getDriverFinance} from '@/app/actions/driver-operations'
import {MapFirstDashboard,type DashboardJob} from '@/components/driver/MapFirstDashboard'
export const dynamic='force-dynamic'
export default async function DriverDashboard(){
 const client=await createClient();const {data:{user}}=await client.auth.getUser();if(!user)return null
 const {data:profile}=await createAdminClient().from('driver_profiles').select('status,is_online').eq('id',user.id).maybeSingle();if(profile?.status!=='approved')return null
 const [available,active,finance]=await Promise.all([getAvailableDeliveries(),client.from('delivery_requests').select('id,status,pickup_address,delivery_address,item_description,price,driver_earning_quote,package_size,service_type,shop_name,created_at').eq('driver_id',user.id).in('status',['accepted','collected','picked_up','in_transit']).order('created_at',{ascending:false}).limit(20),getDriverFinance()])
 return <MapFirstDashboard jobs={(available.data??[]) as DashboardJob[]} activeJobs={(active.data??[]) as DashboardJob[]} todayEarnings={Number(finance.data?.totals.today??0)} completedToday={Number(finance.data?.totals.today_jobs??0)} initialOnline={profile.is_online??false} dataError={active.error?.message||finance.error||(!active.data?.length?available.error:undefined)}/>
}
