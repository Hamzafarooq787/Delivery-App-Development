import {getDashboardUser} from '@/lib/dashboard-user'
import {getRatingSummary} from '@/app/actions/ratings'
import {getDriverDeliveries} from '@/app/actions/delivery'
import {CompletedJobsPanel} from '@/components/driver/completed-jobs-panel'
import {DriverPageControls} from '@/components/driver/driver-page-controls'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;q?:string}>}){
 const params=await searchParams;const page=Math.max(1,Math.min(Math.trunc(Number(params.page))||1,1000000));const q=String(params.q||'').slice(0,80)
 const user=await getDashboardUser()
 const [result,rating]=await Promise.all([getDriverDeliveries("delivered",page,q),user?getRatingSummary(user.id):null])
 return <>{rating?.average!=null && <p className="px-4 pt-3 text-sm text-white">Your rating: {Number(rating.average).toFixed(1)} / 5 · {rating.count} approved</p>}<DriverPageControls path="/dashboard/driver/jobs/completed" page={page} count={result.count??0} q={q}/>{result.error?<p role="alert" className="p-4 text-white">{result.error}</p>:<CompletedJobsPanel jobs={result.data as any[]}/>}</>
}
