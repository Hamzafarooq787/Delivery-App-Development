"use server";
import { runAdminMutation } from "@/lib/admin-access"
import { getAdminActor } from "@/lib/admin-access"
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { revalidatePath } from "next/cache";
async function adminActor() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return null;
  const { data } = await db
    .from("users")
    .select("role")
    .eq("id", user.id)
    .maybeSingle();
  return (await getAdminActor("finance"))?.id ?? null;
}
async function requireAdmin() {
  return Boolean(await adminActor());
}
function refresh() {
  revalidatePath("/dashboard/admin/payouts");
  revalidatePath("/dashboard/driver", "layout");
}
async function reserve(driverId: string) {
  const { data, error } = await createAdminClient().rpc(
    "reserve_driver_payout",
    { p_driver: driverId },
  );
  if (error) return { error: error.message };
  if (!data?.id) return { error: "No pending earnings to reserve" };
  refresh();
  return { success: true, amount: Number(data.amount) };
}
export async function requestDriverPayout(): Promise<{
  error?: string;
  success?: boolean;
  amount?: number;
}> {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) return { error: "Not authenticated" };
  return reserve(user.id);
}
async function review(id: string, status: string, reference?: string) {
  const actor = await adminActor();
  if (!actor) return { error: "Not authorized" };
  const { error } = await createAdminClient().rpc("review_driver_payout", {
    p_id: id,
    p_actor: actor,
    p_status: status,
    p_reference: reference ?? null,
  });
  if (error) return { error: error.message };
  refresh();
  return { success: true };
}
export async function approveDriverPayout(id: string) {
 return runAdminMutation("finance","approveDriverPayout",id,async()=>{
  return review(id, "approved");

 })
}
export async function rejectDriverPayout(id: string) {
 return runAdminMutation("finance","rejectDriverPayout",id,async()=>{
  return review(id, "rejected");

 })
}
export async function completeDriverPayout(id: string, reference?: string) {
 return runAdminMutation("finance","completeDriverPayout",id,async()=>{
  return review(id, "paid", reference);

 })
}
export async function markPayoutPaid(id: string, reference?: string) {
 return runAdminMutation("finance","markPayoutPaid",id,async()=>{
  return review(id, "paid", reference);

 })
}
export async function markAllPayoutsPaid() {
  return {
    error:
      "Confirm each bank payment with its unique payment reference. Bulk marking as paid is disabled.",
  };
}
export async function adminProcessDriverPayout(id: string) {
 return runAdminMutation("finance","adminProcessDriverPayout",id,async()=>{
  if (!(await adminActor())) return { error: "Not authorized" };
  return reserve(id);

 })
}
export async function getDriverPayoutDetails(driverId: string) {
  if (!(await requireAdmin()))
    return {
      earnings: [],
      deliveries: [],
      payoutHistory: [],
      error: "Not authorized",
    };
  const admin = createAdminClient();
  const [earningsRes, deliveriesRes, payoutsHistoryRes] = await Promise.all([
    admin
      .from("driver_earnings")
      .select("id, amount, commission_amount, status, created_at")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(15),
    admin
      .from("delivery_requests")
      .select(
        "id, tracking_number, price, status, created_at, pickup_address, delivery_address",
      )
      .eq("driver_id", driverId)
      .eq("status", "delivered")
      .order("created_at", { ascending: false })
      .limit(10),
    admin
      .from("payouts")
      .select("id, amount, status, created_at")
      .eq("driver_id", driverId)
      .order("created_at", { ascending: false })
      .limit(6),
  ]);
  return {
    earnings: earningsRes.data ?? [],
    deliveries: deliveriesRes.data ?? [],
    payoutHistory: payoutsHistoryRes.data ?? [],
  };
}
