import {getAdminRecords} from '@/app/actions/admin-operations'
import {DisputesPanel} from '@/components/admin/disputes-panel'
import {RecordFilters,RecordPager,type RecordParams} from '@/components/admin/admin-records'
export default async function AdminDisputesPage({searchParams}:{searchParams:Promise<RecordParams>}){const params=await searchParams;const r=await getAdminRecords('disputes',params);if(r.error)throw new Error(r.error);const d=r.data;return <><div className="px-5"><RecordFilters kind="disputes" params={params} statuses={['open','resolved','rejected']}/><RecordPager count={d.count} page={d.page} params={params}/></div><DisputesPanel key={JSON.stringify(params)} disputes={d.rows} total={d.count}/></>}
