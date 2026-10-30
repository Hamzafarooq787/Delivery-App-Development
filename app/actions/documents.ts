"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"

export type DriverDocument = {
  id: string
  document_type: string
  file_url: string
  created_at: string
}

export async function getMyDocuments(): Promise<{ data: DriverDocument[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Not authenticated" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("driver_documents")
    .select("id, document_type, file_url, created_at")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as DriverDocument[]).map(d => ({ ...d, file_url: `/api/driver-document?id=${encodeURIComponent(d.id)}` })) }
}

export async function recordDriverDocument(documentType: string, fileUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

  if (!["identity", "insurance", "vehicle_registration", "selfie"].includes(documentType)) return { error: "Invalid document type" }
  try {
    const url = new URL(fileUrl)
    const prefix = `/storage/v1/object/public/driver-documents/${user.id}/`
    if (url.origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin || !url.pathname.startsWith(prefix)) return { error: "Invalid document owner" }
  } catch { return { error: "Invalid document URL" } }

  if (!(await documentExists(admin,user.id,fileUrl))) return {error:'Document upload could not be verified. Upload the file again.'}
  // Replace any existing doc of the same type
  await admin.from("driver_documents").delete().eq("driver_id", user.id).eq("document_type", documentType)

  const { error } = await admin.from("driver_documents").insert({
    driver_id: user.id,
    document_type: documentType,
    file_url: fileUrl,
  })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/verification")
  return { success: true }
}

export async function submitForReview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const [{ data: caller }, { data: docs, error: docsError }, { data: vehicles, error: vehiclesError }, { data: profile }] = await Promise.all([
    admin.from("users").select("role").eq("id", user.id).maybeSingle(),
    admin.from("driver_documents").select("document_type,file_url").eq("driver_id", user.id),
    admin.from("driver_vehicles").select("id").eq("driver_id", user.id),
    admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle(),
  ])
  if (caller?.role !== "driver") return { error: "Driver account required." }
  if (profile?.status === "approved") return { error: "Your account is already approved." }
  if (docsError || vehiclesError || !vehicles?.length || !["identity", "selfie", "insurance", "vehicle_registration"].every(type => docs?.some(d => d.document_type === type))) return { error: "Upload all required documents and add your vehicle before submitting." }
  const stored=await Promise.all((docs??[]).map(d=>documentExists(admin,user.id,d.file_url)))
  if(stored.some(ok=>!ok))return{error:'A required document is missing from storage. Re-upload it before submitting.'}
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, status: "pending" }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/verification")
  return { success: true }
}

export async function getDriverDocumentsById(driverId: string): Promise<DriverDocument[]> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return []
  const admin = createAdminClient()
  if (user.id !== driverId) {
    const { data: caller } = await admin.from("users").select("role").eq("id", user.id).maybeSingle()
    if (caller?.role !== "admin") return []
  }
  const { data } = await admin
    .from("driver_documents")
    .select("id, document_type, file_url, created_at")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
  return ((data ?? []) as DriverDocument[]).map(d => ({ ...d, file_url: `/api/driver-document?id=${encodeURIComponent(d.id)}` }))
}

async function documentExists(admin:ReturnType<typeof createAdminClient>,owner:string,url:string):Promise<boolean>{
 try{
  const parsed=new URL(url),prefix=`/storage/v1/object/public/driver-documents/${owner}/`
  if(parsed.origin!==new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin||!parsed.pathname.startsWith(prefix))return false
  const path=decodeURIComponent(parsed.pathname.slice('/storage/v1/object/public/driver-documents/'.length));const parts=path.split('/');if(parts.some(p=>!p||p==='.'||p==='..'))return false
  const name=parts.pop()!;const {data,error}=await admin.storage.from('driver-documents').list(parts.join('/'),{search:name,limit:100})
  return !error&&!!data?.some(file=>file.name===name)
 }catch{return false}
}
