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
  return { data: (data ?? []) as DriverDocument[] }
}

export async function recordDriverDocument(documentType: string, fileUrl: string) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return { error: "Not authenticated" }

  const admin = createAdminClient()

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
  const { error } = await admin
    .from("driver_profiles")
    .upsert({ id: user.id, status: "pending" }, { onConflict: "id" })

  if (error) return { error: error.message }
  revalidatePath("/dashboard/driver/verification")
  return { success: true }
}

export async function getDriverDocumentsById(driverId: string): Promise<DriverDocument[]> {
  const admin = createAdminClient()
  const { data } = await admin
    .from("driver_documents")
    .select("id, document_type, file_url, created_at")
    .eq("driver_id", driverId)
    .order("created_at", { ascending: false })
  return (data ?? []) as DriverDocument[]
}
