"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { submitDriverIncident } from "@/app/actions/driver-incident"
import { INCIDENT_TYPES } from "@/lib/driver-incident"
import { compressImage } from "@/lib/image-compress"

export function DriverIncidentForm({jobs,jobsUnavailable}:{jobs:{id:string;tracking_number:string|null}[];jobsUnavailable:boolean}){
 const router=useRouter()
 const [busy,setBusy]=useState(false),[error,setError]=useState("")
 const field="block w-full rounded-lg border border-white/20 bg-[var(--brand-panel)] p-3"
 return <form className="mx-auto max-w-xl space-y-4 p-4 text-white" onSubmit={async event=>{
  event.preventDefault()
  if(busy)return
  const form=new FormData(event.currentTarget)
  setBusy(true);setError("")
  try{
   const photo=form.get("photo")
   if(photo instanceof File && photo.size){
    if(photo.size>20_000_000){setError("Choose a photo under 20 MB.");return}
    const compressed=await compressImage(photo,850,0.68)
    if(compressed.size>400000){setError("This photo is still too large. Choose a smaller one.");return}
    form.set("photo",compressed,"incident.jpg")
   }
   const result=await submitDriverIncident(form)
   if(!result.id){setError(result.error??"The report could not be saved.");return}
   router.push(`/dashboard/driver/support?ticket=${result.id}`)
  }catch{setError("Could not confirm the report. Check Support before retrying.")}
  finally{setBusy(false)}
 }}>
  <h1 className="text-2xl font-bold">Report incident</h1>
  <label className="block">Incident type<select className={field} name="type" required defaultValue=""><option value="" disabled>Choose a type</option>{INCIDENT_TYPES.map(type=><option key={type}>{type}</option>)}</select></label>
  <label className="block">Related order (optional)<select className={field} name="job" disabled={jobsUnavailable}><option value="">No order selected</option>{jobs.map(job=><option value={job.id} key={job.id}>{job.tracking_number??job.id.slice(0,8)}</option>)}</select></label>
  {jobsUnavailable&&<p role="status">Your order list could not load. You can add the order reference to the description.</p>}
  <label className="block">Description<textarea className={field} name="description" required minLength={10} maxLength={3000} rows={5}/></label>
  <label className="block">Photo (optional)<input className={field} type="file" name="photo" accept="image/jpeg,image/png,image/webp"/></label>
  {error&&<p role="alert">{error}</p>}
  <button type="submit" disabled={busy} className="min-h-11 rounded-xl bg-[var(--brand-strong)] px-5 font-bold text-[var(--brand-ink)]">{busy?"Sending…":"Send incident report"}</button>
 </form>
}
