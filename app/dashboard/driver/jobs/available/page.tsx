import {getAvailableDeliveries} from '@/app/actions/delivery'
import {AvailableJobsPanel} from '@/components/driver/available-jobs-panel'
import {DriverPageControls} from '@/components/driver/driver-page-controls'
export const dynamic='force-dynamic'
export default async function Page({searchParams}:{searchParams:Promise<{page?:string;q?:string;job?:string}>}){
 const params=await searchParams;const page=Math.max(1,Math.min(Math.trunc(Number(params.page))||1,1000000));const q=String(params.q||'').slice(0,80)
 const result=await getAvailableDeliveries(page,q,params.job)
 return <><DriverPageControls path="/dashboard/driver/jobs/available" page={page} count={result.count??0} q={q}/>{result.error?<p role="alert" className="p-4 text-white">{result.error}</p>:<>{result.eligibilityNotice && <p role="status" className="px-4 py-2 text-sm text-white/80">{result.eligibilityNotice}</p>}<AvailableJobsPanel jobs={result.data as any[]}/></>}</>
}
