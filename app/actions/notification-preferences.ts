"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function getServicePushPreference() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { data, error } = await db
    .from("users")
    .select("service_push_enabled")
    .eq("id", user.id)
    .single();
  return error
    ? { error: "Unable to load notification preferences" }
    : { enabled: data.service_push_enabled };
}
export async function saveServicePushPreference(enabled: boolean) {
  if (typeof enabled !== "boolean") return { error: "Invalid preference" };
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  const { error } = await createAdminClient()
    .from("users")
    .update({ service_push_enabled: enabled })
    .eq("id", user.id);
  return error
    ? { error: "Unable to save notification preference" }
    : { success: true };
}
