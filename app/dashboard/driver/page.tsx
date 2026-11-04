import {getRatingSummary} from '@/app/actions/ratings'
import {getDashboardUser} from '@/lib/dashboard-user'
import {getDriverActiveJobs,getDriverReadProfile} from '@/lib/driver-read-context'
import {getAvailableDeliveries} from '@/app/actions/delivery'
import {getDriverFinance} from '@/app/actions/driver-operations'
import {MapFirstDashboard,type DashboardJob} from '@/components/driver/MapFirstDashboard'
export const dynamic='force-dynamic'
export default async function DriverDashboard(){
 const user=await getDashboardUser();if(!user)return null
 const {data:profile}=await getDriverReadProfile(user.id);if(profile?.status!=='approved')return null
 const [available,active,finance,rating]=await Promise.all([getAvailableDeliveries(),getDriverActiveJobs(user.id),getDriverFinance(),getRatingSummary(user.id)])
 return <MapFirstDashboard rating={rating} jobs={(available.data??[]) as DashboardJob[]} activeJobs={(active.data??[]) as DashboardJob[]} todayEarnings={Number(finance.data?.totals.today??0)} completedToday={Number(finance.data?.totals.today_jobs??0)} initialOnline={profile.is_online??false} dataError={(active.error ? "Active jobs could not load. Please retry." : undefined)||finance.error||(!active.data?.length?available.error:undefined)}/>
}
