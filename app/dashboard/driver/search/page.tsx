import Link from 'next/link'
import {getDriverDeliveries} from '@/app/actions/delivery'
import {DriverPageControls} from '@/components/driver/driver-page-controls'
export default async function Search({searchParams}:{searchParams:Promise<{q?:string;page?:string}>}){
 const params=await searchParams;const page=Math.max(1,Math.min(Math.trunc(Number(params.page))||1,1000000));const q=String(params.q||'').slice(0,80)
 const r=await getDriverDeliveries('all',page,q)
 if(r.error)throw new Error(r.error)
 return <div className="p-4 text-white"><h1 className="text-2xl font-bold">Search your jobs</h1><DriverPageControls path="/dashboard/driver/search" page={page} count={r.count??0} q={q}/><div className="space-y-3">{r.data.map(j=><Link key={j.id} className="block rounded-xl bg-[var(--brand-panel)] p-4" href={'/dashboard/driver/jobs/'+j.id}>{j.tracking_number} · {j.status}<p className="text-sm text-gray-300">{j.pickup_address} → {j.delivery_address}</p></Link>)}{!r.data.length&&<p>No matching jobs.</p>}</div></div>
}
