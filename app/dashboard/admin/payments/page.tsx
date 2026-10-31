import {getAdminActor} from "@/lib/admin-access"
import {RecordFilters} from "@/components/admin/admin-records"
import {parseAdminDate} from "@/lib/admin-operations"
import {PaymentReconcileButton} from "@/components/admin/payment-reconcile-button"
import { CardPaymentsOverview } from "@/components/admin/card-payments-overview";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
export default async function AdminPaymentsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string;q?:string;status?:string;from?:string;to?:string }>;
}) {
  if(!(await getAdminActor("finance")))return <p className="p-6 text-white">Finance permission is required.</p>
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
  let paymentQuery=admin.from("payments").select("id,delivery_id,related_delivery_id,purpose,amount,status,payment_method,stripe_payment_intent,created_at,refund_jobs").order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1)
  if(params.status)paymentQuery=paymentQuery.eq('status',params.status)
  if(params.q){const q=params.q.replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100);paymentQuery=paymentQuery.or(`id.eq.${/^[0-9a-f-]{36}$/i.test(q)?q:'00000000-0000-4000-8000-000000000000'},stripe_payment_intent.ilike.%${q}%`)}
  const from=parseAdminDate(params.from),to=parseAdminDate(params.to,true);if(from)paymentQuery=paymentQuery.gte('created_at',from);if(to)paymentQuery=paymentQuery.lt('created_at',to)
  const [payments,payouts]=await Promise.all([paymentQuery,admin.from('payouts').select('id,amount,status,payment_reference,created_at,processed_at').order('created_at',{ascending:false}).order('id').range((page-1)*50,page*50-1)])
  if (payments.error || payouts.error)
    throw new Error("Payment records could not load. Please retry.");
  const money = (v: unknown) => `£${Number(v).toFixed(2)}`;
  return (
    <div className="p-4 md:p-8 text-white space-y-6">
      <h1 className="text-3xl font-bold">Payments</h1>
      <RecordFilters kind="payments" params={params} statuses={["pending","paid","failed"]}/>
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
              (r: { key: string; amount: number; state: string }) => (
                <p key={r.key}>
                  Refund {money(r.amount)} — {r.state}
                </p>
              ),
            )}
            {p.payment_method==="stripe"&&<PaymentReconcileButton id={p.id}/>}
            {(p.delivery_id||p.related_delivery_id) && (
              <Link
                className="underline"
                href={`/dashboard/admin/orders/${p.delivery_id??p.related_delivery_id}`}
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
        {page > 1 && <Link href={`?${new URLSearchParams({...params,page:String(page-1)})}`}>Previous</Link>}
        {(payments.data.length === 50 || payouts.data.length === 50) && (
          <Link href={`?${new URLSearchParams({...params,page:String(page+1)})}`}>Next</Link>
        )}
      </nav>
    </div>
  );
}
