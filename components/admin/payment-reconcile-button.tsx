'use client'
import {useState,useTransition} from 'react'
import {reconcileAdminPayment} from '@/app/actions/admin-operations'
import {useRouter} from 'next/navigation'
export function PaymentReconcileButton({id}:{id:string}){const [busy,start]=useTransition(),[message,setMessage]=useState('');const router=useRouter();return <div className="my-2"><button disabled={busy} className="underline" onClick={()=>start(async()=>{const r=await reconcileAdminPayment(id);setMessage(r.error??'Provider record reconciled.');router.refresh()})}>{busy?'Checking Stripe…':'Reconcile with Stripe'}</button><p role="status">{message}</p></div>}
