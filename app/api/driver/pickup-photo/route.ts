import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { boundedFetch, shortRequest } from "@/lib/short-request"

const uuid=/^[a-f0-9]{8}(?:-[a-f0-9]{4}){3}-[a-f0-9]{12}$/i
export async function POST(request:Request) {
  const reply=(data:unknown,status=200)=>Response.json(data,{status,headers:{"Cache-Control":"private, no-store"}})
  if(request.headers.get("origin")!==new URL(request.url).origin)return reply({error:"Open GoDrop directly to upload."},403)
  try {
    return await shortRequest((async()=>{
      const form=await request.formData(), id=String(form.get("id")??""), key=String(form.get("key")??""), photo=form.get("photo")
      if(!uuid.test(id)||!uuid.test(key)||!(photo instanceof File)||photo.type!=="image/jpeg"||photo.size<4||photo.size>350000)return reply({error:"Choose a JPEG photo under 350 KB."},400)
      const bytes=new Uint8Array(await photo.arrayBuffer())
      if(bytes[0]!==255||bytes[1]!==216||bytes[2]!==255)return reply({error:"The photo is not a valid JPEG."},400)
      const db=await createClient(boundedFetch(4500))
      const {data,error:authError}=await db.auth.getClaims()
      if(authError?.name==="AuthRetryableFetchError")return reply({error:"Sign-in service is busy. Retry the upload."},503)
      const driver=data?.claims.sub
      if(!driver)return reply({error:"Sign in as the assigned driver."},401)
      const admin=createAdminClient(boundedFetch(7500))
      const {data:order,error}=await admin.from("delivery_requests").select("id").eq("id",id).eq("driver_id",driver).eq("status","accepted").eq("service_type","delivery").maybeSingle()
      if(error)return reply({error:"Could not verify the job. Retry the upload."},503)
      if(!order)return reply({error:"Only the assigned driver can upload for an accepted parcel."},403)
      const storage=admin.storage.from("driver-documents")
      const path=`${driver}/parcel-${id}-${key}.jpg`
      const uploaded=await storage.upload(path,bytes,{contentType:"image/jpeg",upsert:false})
      if(uploaded.error&&String(uploaded.error.statusCode)!=="409"&&!/already exists|duplicate/i.test(uploaded.error.message))return reply({error:"Photo upload failed. Retry with the same photo."},503)
      return reply({url:storage.getPublicUrl(path).data.publicUrl})
    })(),14500)
  } catch {return reply({error:"Photo upload took too long. Retry with the same photo."},504)}
}
