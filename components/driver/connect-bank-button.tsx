"use client";
import { useState, useTransition, useEffect } from "react";
import { getDriverBankStatus } from '@/app/actions/driver-operations';
import { connectDriverBank } from "@/app/actions/bank-payouts";
export function ConnectBankButton() {
  const [busy, start] = useTransition();
  const [error, setError] = useState("");
  const [status,setStatus]=useState<{state:string;message:string;automatic?:boolean}|null>(null);
  async function refresh(){try{setStatus(await getDriverBankStatus())}catch{setStatus({state:'error',message:'Bank status could not load. Please retry.'})}}
  useEffect(()=>{void refresh();window.addEventListener('focus',refresh);return()=>window.removeEventListener('focus',refresh)},[]);
  return <section className="mb-6 p-5 rounded-2xl bg-[var(--brand-panel)] text-white border border-white/15">
    <h3 className="font-bold">Bank payouts</h3>
    <p className="my-2 text-sm" role="status">{status?.message??'Checking bank verification…'}</p>
    {status&&<p className="mb-3 text-sm">{status.automatic?'Weekly bank payouts are enabled.':'Automatic bank transfers are currently paused. Your earnings remain recorded.'}</p>}
    <button className="mb-3 text-sm underline" onClick={()=>void refresh()}>Refresh bank status</button>
    <p className="text-sm my-2">Add or update your bank details securely with Stripe. Complete its identity checks to receive weekly payouts. A return from Stripe does not mean verification is complete.</p>
    <button disabled={busy} className="rounded-xl bg-[var(--brand-strong)] text-[var(--brand-ink)] px-4 py-3 font-bold disabled:opacity-50" onClick={() => start(async () => {
      setError("");
      try { const result = await connectDriverBank(); if (result.url) window.location.assign(result.url); else setError(result.error ?? "Please retry."); }
      catch { setError("Unable to open bank setup. Please retry."); }
    })}>{busy ? "Opening Stripe…" : "Set up / update bank account"}</button>
    {error && <p role="alert" className="mt-3 text-sm text-red-300">{error}</p>}
  </section>;
}
