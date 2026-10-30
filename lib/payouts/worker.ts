import "server-only";
import { randomUUID } from "node:crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { getStripe } from "@/lib/stripe/server";
import { executeBankPayout, type BankOperation } from "./engine";

export async function runBankPayouts(payoutId?: string) {
  const db = createAdminClient();
  const token = randomUUID();
  const lock = await db.rpc("claim_payout_worker", { p_token: token });
  if (lock.error) throw new Error("Payout worker lock unavailable");
  if (!lock.data) return { busy: true, checked: 0, problems: 0 };
  const deadline = Date.now() + 40_000;
  let checked = 0, problems = 0;
  try {
    const settings = await db.from("surge_pricing_settings").select("automatic_payouts").order("id").limit(1).single();
    if (settings.error) throw settings.error;
    const result = await db.rpc("bank_payout_queue", { p_enabled: settings.data.automatic_payouts, p_id: payoutId ?? null });
    if (result.error) throw result.error;
    const rows = result.data ?? [];
    for (const p of rows) {
      if (Date.now() > deadline) break;
      let op: BankOperation | null = p.provider;
      try {
        if (!op) {
          const driver = await db.from("driver_profiles").select("stripe_connect_account_id,status").eq("id", p.driver_id).single();
          if (driver.error) throw driver.error;
          if (driver.data.status !== "approved" || !driver.data.stripe_connect_account_id) continue;
          const start = await db.rpc("start_bank_payout", { p_id: p.id, p_account: driver.data.stripe_connect_account_id, p_token: token });
          if (start.error) throw start.error;
          op = start.data;
        }
        if (!op) continue;
        // Pausing stops new movement, but continues checking already-created bank payouts.
        if (!settings.data.automatic_payouts && !op.payout_id) continue;
        const save = async (value: BankOperation) => {
          const saved = await db.rpc("save_bank_payout", { p_id: p.id, p_provider: value });
          if (saved.error) throw saved.error;
          op = value;
        };
        const completed = await executeBankPayout(p.id, Number(p.amount), op, {
          stripe: getStripe(), save,
          protectedPence: async () => {
            const reserve = await db.rpc("payout_protected_funds");
            if (reserve.error) throw reserve.error;
            return Math.ceil(Number(reserve.data) * 100);
          },
        });
        await save(completed);
        checked++;
      } catch (error) {
        problems++;
        // Keep provider IDs even when a subsequent request fails. Never release claims.
        const code = error instanceof Error ? error.message : (typeof error === "object" && error && "message" in error ? String(error.message) : "provider_check_failed");
        if (op) {
          const saved = await db.rpc("save_bank_payout", { p_id: p.id, p_provider: { ...op, error: code.slice(0, 200) } });
          if (saved.error) console.error("[payout] Could not persist provider result", p.id);
        } else {
          await db.from("payouts").update({ admin_note: code.slice(0, 200) }).eq("id", p.id).is("provider", null);
        }
      }
    }
    return { checked, problems, automatic: settings.data.automatic_payouts };
  } finally {
    await db.from("surge_pricing_settings").update({ payout_worker_token: null, payout_worker_until: null }).eq("payout_worker_token", token);
  }
}
