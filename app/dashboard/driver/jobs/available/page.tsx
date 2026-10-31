import {getAvailableDeliveries} from '@/app/actions/delivery'
import {AvailableJobsPanel} from '@/components/driver/available-jobs-panel'
import {DriverPageControls} from '@/components/driver/driver-page-controls'
import {DriverRefresh} from '@/components/driver/driver-refresh'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;q?:string}>}){
 const params=await searchParams;const page=Math.max(1,Math.min(Math.trunc(Number(params.page))||1,1000000));const q=String(params.q||'').slice(0,80)
 const result=await getAvailableDeliveries(page,q)
 return <><DriverRefresh/><DriverPageControls path="/dashboard/driver/jobs/available" page={page} count={result.count??0} q={q}/>{result.error?<p role="alert" className="p-4 text-white">{result.error}</p>:<AvailableJobsPanel jobs={result.data as any[]}/>}</>
}
