import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function CardPaymentsOverview() {
  const client = await createClient();
  const {
    data: { user },
  } = await client.auth.getUser();
  if (!user) return null;
  const admin = createAdminClient();
  const { data: caller } = await admin
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (caller?.role !== "admin") return null;
  const { data, error } = await admin.rpc("card_payment_summary");
  if (error)
    return (
      <p role="alert">
        Card payment reconciliation is unavailable. Refresh to retry.
      </p>
    );
  const fields = [
    ["Confirmed card payments", "customerPayments"],
    ["Shopping funds (not revenue)", "shoppingFunds"],
    ["Delivery and shopping service fees", "serviceFees"],
    ["Stripe processing costs", "processingFees"],
    ["Completed card refunds", "refundsCompleted"],
    ["Pending card refunds", "refundsPending"],
  ];
  return (
    <section className="my-5 rounded-2xl bg-[var(--brand-panel)] p-5 text-white">
      <h2 className="font-bold">Direct card payments</h2>
      <div className="mt-3 grid grid-cols-2 gap-4 md:grid-cols-3">
        {fields.map(([label, key]) => (
          <div key={key}>
            <p className="text-xs">{label}</p>
            <strong>{new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"}).format(Number(data?.[key] ?? 0))}</strong>
          </div>
        ))}
      </div>
      {Number(data?.unconfirmedProcessingFees) > 0 && (
        <p className="mt-3 text-sm">
          Processing costs for {data.unconfirmedProcessingFees} payments are
          awaiting Stripe confirmation.
        </p>
      )}
      <p className="mt-3 text-xs">
        Pending checkouts are excluded. Service fees are before driver earnings, refunds and processing costs.
        Shopping funds are tracked separately. Open an order for its refund
        details.
      </p>
    </section>
  );
}
