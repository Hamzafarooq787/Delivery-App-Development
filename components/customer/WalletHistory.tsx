'use client'
import {useEffect,useState} from 'react'
import {getWalletTransactions,type WalletTransaction} from '@/app/actions/wallet'
import {useCustomerLiveRefresh} from '@/hooks/use-customer-live-refresh'
import {CustomerPagination,useCustomerPageSize,money} from './CustomerPage'
export function WalletHistory(){
 const [rows,setRows]=useState<WalletTransaction[]>([]),[count,setCount]=useState(0),[page,setPage]=useState(1)
 const [loading,setLoading]=useState(true),[error,setError]=useState(''),[revision,setRevision]=useState(0)
 const size=useCustomerPageSize(8,4)
 useCustomerLiveRefresh(async()=>{setRevision(v=>v+1)},'wallet_transactions',20000)
 useEffect(()=>{
  let alive=true;setLoading(true)
  void getWalletTransactions(page,size).then(r=>{if(!alive)return;if(r.error){setError(r.error);return}setRows(r.data);setCount(r.totalCount);setError('');const last=Math.max(1,Math.ceil(r.totalCount/size));if(page>last)setPage(last)}).catch(()=>{if(alive)setError('Could not load wallet transactions. Please retry.')}).finally(()=>{if(alive)setLoading(false)})
  return()=>{alive=false}
 },[page,size,revision])
 return <section aria-label="Wallet transaction history" className="space-y-3 text-white">
  <h3 className="text-sm font-bold text-gray-400 uppercase tracking-widest">Transaction history</h3>
  {error&&<p role="alert" className="text-red-300">{error} <button className="underline" onClick={()=>setRevision(v=>v+1)}>Try again</button></p>}
  {loading?<p role="status">Loading transactions…</p>:!rows.length?<p>No transactions yet.</p>:<div className="rounded-2xl border border-white/10 divide-y divide-white/10">{rows.map(tx=><article key={tx.id} className="flex items-center gap-3 px-4 py-4"><div className="flex-1 min-w-0"><p className="text-sm font-semibold break-words">{tx.description??tx.type.replaceAll('_',' ')}</p><p className="text-xs text-gray-400">{new Date(tx.created_at).toLocaleString('en-GB')}</p></div><strong className={`shrink-0 text-sm ${tx.amount>0?'text-emerald-300':'text-red-300'}`}>{tx.amount>0?'+':''}{money(Number(tx.amount))}</strong></article>)}</div>}
  <CustomerPagination page={page} count={count} size={size} onChange={setPage}/>
 </section>
}
