import {adminGetPendingVerifications,adminGetPendingVerificationCount} from '@/app/actions/delivery'
import {VerificationRequestsPanel} from '@/components/admin/verification-requests-panel'
import {RecordPager} from '@/components/admin/admin-records'
export default async function VerificationRequestsPage({searchParams}:{searchParams:Promise<{page?:string}>}){const params=await searchParams,page=Math.max(1,Math.trunc(Number(params.page)||1));const [result,count]=await Promise.all([adminGetPendingVerifications(page),adminGetPendingVerificationCount()]);if(result.error)throw new Error(result.error);return <><div className="px-5"><RecordPager count={count} page={page} params={params}/></div><VerificationRequestsPanel key={page} initialDrivers={result.data}/></>}
