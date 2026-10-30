import { CardPaymentsOverview } from "@/components/admin/card-payments-overview";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data: actor } = await db
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (actor?.role !== "admin") redirect("/dashboard");
  const params = await searchParams;
  const page = Math.max(
    1,
    Math.min(100000, Math.floor(Number(params.page) || 1)),
  );
  const admin = createAdminClient();
  const [payments, payouts] = await Promise.all([
    admin
      .from("payments")
      .select(
        "id,delivery_id,amount,status,payment_method,stripe_payment_intent,created_at,refund_jobs",
      )
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 50, page * 50 - 1),
    admin
      .from("payouts")
      .select("id,amount,status,payment_reference,created_at,processed_at")
      .order("created_at", { ascending: false })
      .order("id")
      .range((page - 1) * 50, page * 50 - 1),
  ]);
  if (payments.error || payouts.error)
    throw new Error("Payment records could not load. Please retry.");
  const money = (v: unknown) => `£${Number(v).toFixed(2)}`;
  return (
    <div className="p-4 md:p-8 text-white space-y-6">
      <h1 className="text-3xl font-bold">Payments</h1>
      <CardPaymentsOverview />
      <p>
        Payment records and payout records have separate states. Order status
        does not indicate whether money was received.
      </p>
      <h2 className="text-xl font-bold">Customer payments</h2>
      <div className="space-y-3">
        {payments.data.map((p) => (
          <div key={p.id} className="rounded-xl bg-[var(--brand-panel)] p-4">
            <strong>
              {money(p.amount)} — {p.status}
            </strong>
            <p>
              {p.payment_method} ·{" "}
              {new Date(p.created_at).toLocaleString("en-GB", {
                timeZone: "Europe/London",
              })}
            </p>
            <p className="break-all text-sm">
              {p.stripe_payment_intent ?? p.id}
            </p>
            {(p.refund_jobs ?? []).map(
              (r: { key: string; amount: number; status: string }) => (
                <p key={r.key}>
                  Refund {money(r.amount)} — {r.status}
                </p>
              ),
            )}
            {p.delivery_id && (
              <Link
                className="underline"
                href={`/dashboard/admin/orders/${p.delivery_id}`}
              >
                View order
              </Link>
            )}
          </div>
        ))}
      </div>
      <h2 className="text-xl font-bold">Driver payouts</h2>
      {payouts.data.map((p) => (
        <div key={p.id} className="rounded-xl bg-[var(--brand-panel)] p-4">
          <strong>
            {money(p.amount)} — {p.status}
          </strong>
          <p>{p.payment_reference ?? "No confirmed payment reference"}</p>
          <p>
            {p.processed_at
              ? new Date(p.processed_at).toLocaleString("en-GB", {
                  timeZone: "Europe/London",
                })
              : "Not processed"}
          </p>
        </div>
      ))}
      <nav className="flex gap-6">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {(payments.data.length === 50 || payouts.data.length === 50) && (
          <Link href={`?page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </div>
  );
}
