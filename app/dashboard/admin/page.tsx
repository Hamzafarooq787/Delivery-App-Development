import Link from 'next/link'
import {getAdminActor} from '@/lib/admin-access'
import {createAdminClient} from '@/lib/supabase/admin'
import {getAdminFinance} from '@/app/actions/admin-operations'
import {FinanceSummary} from '@/components/admin/finance-summary'
import {NeedsAttention} from '@/components/admin/needs-attention'
import {ukDate} from '@/lib/admin-operations'
export default async function AdminDashboardPage(){
 const actor=await getAdminActor('any');if(!actor)return <p className="p-6 text-white">Admin access needs verification. <Link className="underline" href="/dashboard/admin/security">Verify your authenticator</Link></p>
 const db=createAdminClient(),canOperate=actor.owner||actor.scopes.includes('operations')
 const [finance,recent,pending]=await Promise.all([getAdminFinance(),canOperate?db.from('delivery_requests').select('id,tracking_number,status,created_at,pickup_address,delivery_address').order('created_at',{ascending:false}).limit(8):Promise.resolve({data:[],error:null}),canOperate?db.from('driver_profiles').select('id,verification_submitted_at,users(full_name)').eq('status','pending').not('verification_submitted_at','is',null).order('verification_submitted_at').limit(5):Promise.resolve({data:[],error:null})])
 if(recent.error||pending.error)throw new Error('Overview records could not load.')
 return <div className="p-4 md:p-8 space-y-6 text-white"><h1 className="text-3xl font-bold">Admin overview</h1>{finance.data&&<FinanceSummary data={finance.data}/>}<NeedsAttention/>{canOperate&&<><section className="rounded-xl bg-[var(--brand-panel)] p-5"><h2 className="text-xl font-bold mb-4">Recent orders</h2>{recent.data?.map((order:any)=><Link key={order.id} className="block border-t border-white/10 py-3" href={`/dashboard/admin/orders/${order.id}`}><strong>{order.tracking_number}</strong> · {order.status}<p className="text-sm">{order.pickup_address} → {order.delivery_address}</p><p className="text-xs text-gray-300">{ukDate(order.created_at)}</p></Link>)}<Link className="underline" href="/dashboard/admin/orders">All orders and filters</Link></section><section className="rounded-xl bg-[var(--brand-panel)] p-5"><h2 className="text-xl font-bold">Submitted verification requests</h2>{pending.data?.length?pending.data.map((driver:any)=><Link key={driver.id} className="block py-3 underline" href={`/dashboard/admin/drivers/${driver.id}`}>{driver.users?.full_name??'Driver'} · {ukDate(driver.verification_submitted_at)}</Link>):<p className="my-3">No submitted applications awaiting review.</p>}<Link href="/dashboard/admin/verification" className="underline">Open verification queue</Link></section></>}<Link className="underline" href="/dashboard/admin/reports">Financial reports and exports</Link></div>
}
