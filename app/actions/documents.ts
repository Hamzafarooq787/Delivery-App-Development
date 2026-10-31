"use server"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { revalidatePath } from "next/cache"
import { driverComplianceReady } from "@/lib/driver-compliance"

export type DriverDocument = {
  id: string
  document_type: string
  file_url: string
  created_at: string
  expires_on?: string | null
}

export async function getMyDocuments(): Promise<{ data: DriverDocument[]; error?: string }> {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { data: [], error: "Not authenticated" }

  const admin = createAdminClient()
  const { data, error } = await admin
    .from("driver_documents")
    .select("id, document_type, file_url, created_at, expires_on")
    .eq("driver_id", user.id)
    .order("created_at", { ascending: false })

  if (error) return { data: [], error: error.message }
  return { data: ((data ?? []) as DriverDocument[]).map(d => ({ ...d, file_url: `/api/driver-document?id=${encodeURIComponent(d.id)}` })) }
}

export async function recordDriverDocument(documentType: string, fileUrl: string, expiresOn?: string) {
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
  if (expiresOn && (!/^\d{4}-\d{2}-\d{2}$/.test(expiresOn) || !Number.isFinite(Date.parse(expiresOn)))) return {error:"Enter a valid expiry date."}
  if (documentType === "insurance" && !expiresOn) return {error:"Enter the insurance expiry date."}
  const { error } = await admin.rpc("save_driver_document", {
    p_driver: user.id,
    p_type: documentType,
    p_url: fileUrl,
    p_expires: expiresOn || null,
  })

  if (error) return { error: error.message.includes("finish_active_job")
    ? "Finish your active delivery before changing verification documents."
    : "Document could not be saved. Your previous document has been kept. Please retry." }
  revalidatePath("/dashboard/driver", "layout")
  revalidatePath("/dashboard/admin/verification")
  return { success: true }
}

export async function submitForReview() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()
  const [{ data: caller }, { data: docs, error: docsError }, { data: vehicles, error: vehiclesError }, { data: profile }] = await Promise.all([
    admin.from("users").select("role").eq("id", user.id).maybeSingle(),
    admin.from("driver_documents").select("document_type,file_url,expires_on").eq("driver_id", user.id),
    admin.from("driver_vehicles").select("id,vehicle_type").eq("driver_id", user.id),
    admin.from("driver_profiles").select("status").eq("id", user.id).maybeSingle(),
  ])
  if (caller?.role !== "driver") return { error: "Driver account required." }
  if (profile?.status === "approved") return { error: "Your account is already approved." }
  if (docsError || vehiclesError || !driverComplianceReady(vehicles??[],docs??[])) return { error: "Add your vehicle and all current required documents, including insurance expiry, before submitting." }
  const stored=await Promise.all((docs??[]).map(d=>documentExists(admin,user.id,d.file_url)))
  if(stored.some(ok=>!ok))return{error:'A required document is missing from storage. Re-upload it before submitting.'}
  const { error } = await admin.rpc("submit_driver_verification", {p_driver:user.id})

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver", "layout")
  revalidatePath("/dashboard/admin/verification")
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
    .select("id, document_type, file_url, created_at, expires_on")
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
