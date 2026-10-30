"use server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
async function actor() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  return data?.role === "admin" ? user.id : null;
}
export async function getNotificationSettings() {
  if (!(await actor())) return { error: "Not authorized" };
  const { data, error } = await createAdminClient()
    .from("surge_pricing_settings")
    .select("notification_settings")
    .eq("id", 1)
    .single();
  return error
    ? { error: "Unable to load notification settings" }
    : { settings: data.notification_settings };
}
export async function saveNotificationSettings(
  settings: Record<string, { enabled: boolean; title: string }>,
) {
  const id = await actor();
  if (!id) return { error: "Not authorized" };
  const allowed = [
    "new-delivery",
    "delivery-accepted",
    "delivery-collected",
    "delivery-in-transit",
    "delivery-cancelled",
    "delivered",
    "bfm-stage",
    "bfm-sub",
    "bfm-purchased",
  ];
  const clean: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(settings)) {
    if (
      !allowed.includes(key) ||
      typeof value.enabled !== "boolean" ||
      typeof value.title !== "string" ||
      value.title.length > 100
    )
      return { error: "Invalid notification template" };
    clean[key] = { enabled: value.enabled, title: value.title.trim() };
  }
  const { error } = await createAdminClient()
    .from("surge_pricing_settings")
    .update({
      notification_settings: {
        ...clean,
        updated_by: id,
        updated_at: new Date().toISOString(),
      },
    })
    .eq("id", 1)
    .select("id")
    .single();
  return error
    ? { error: "Unable to save notification settings" }
    : { success: true };
}
