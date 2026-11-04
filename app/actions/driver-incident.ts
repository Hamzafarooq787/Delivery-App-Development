"use server"

import { after } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch } from "@/lib/short-request"
import { notifySupportUpdate } from "@/lib/notifications/internal"
import { INCIDENT_TYPES } from "@/lib/driver-incident"

export async function submitDriverIncident(form: FormData) {
  const db=await createClient(boundedFetch(3500))
  const {data:{user}}=await db.auth.getUser()
  if(!user)return {error:"Sign in to report an incident."}
  const admin=createAdminClient(boundedFetch(5000))
  const {data:profile}=await admin.from("users").select("role,account_status").eq("id",user.id).maybeSingle()
  if(profile?.role!=="driver" || profile.account_status!=="active")return {error:"An active driver account is required."}
  const type=String(form.get("type")??"")
  const job=String(form.get("job")??"")
  const description=String(form.get("description")??"").trim()
  if(!INCIDENT_TYPES.some(v=>v===type) || description.length<10 || description.length>3000)return {error:"Choose an incident type and write 10–3,000 characters."}
  let reference=""
  if(job){
    if(!/^[a-f0-9-]{36}$/i.test(job))return {error:"Choose one of your jobs."}
    const {data:order}=await admin.from("delivery_requests").select("tracking_number").eq("id",job).eq("driver_id",user.id).maybeSingle()
    if(!order)return {error:"That order is no longer assigned to you."}
    reference=order.tracking_number || job
  }
  const photo=form.get("photo")
  const id=crypto.randomUUID()
  let key:string|null=null
  if(photo instanceof File && photo.size){
    if(photo.size>400000 || photo.type!=="image/jpeg")return {error:"Choose a JPEG photo below 400 KB."}
    const bytes=new Uint8Array(await photo.arrayBuffer())
    if(bytes[0]!==255 || bytes[1]!==216 || bytes[2]!==255)return {error:"The photo is not a valid JPEG."}
    key=`${user.id}/${id}.jpg`
    const {error}=await admin.storage.from("incident-evidence").upload(key,bytes,{contentType:"image/jpeg"})
    if(error)return {error:"The photo could not upload. Please try again."}
  }
  const {error}=await admin.from("support_tickets").insert({id,user_id:user.id,subject:`Driver incident: ${type}`,message:reference?`Order: ${reference}\n\n${description}`:description,status:"open",incident_photo_key:key})
  if(error)return {error:"The report could not be confirmed. Check Support before retrying."}
  after(()=>notifySupportUpdate(id,user.id,id))
  return {id}
}
