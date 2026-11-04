import { paymentDisplayStatus } from "@/lib/payment-display"
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
  let paymentQuery=admin.from("payments").select("id,delivery_id,related_delivery_id,purpose,amount,status,payment_method,stripe_payment_intent,stripe_session_id,created_at,refund_jobs").order("created_at",{ascending:false}).order("id").range((page-1)*50,page*50-1)
  if(params.status)paymentQuery=paymentQuery.eq('status',params.status)
  if(params.q){
    const q=params.q.trim().replace(/[^a-zA-Z0-9_-]/g,'').slice(0,100)
    const matched=q?await admin.from("delivery_requests").select("id").ilike("tracking_number",q).limit(20):null
    const ids=matched?.data?.map(o=>o.id)??[]
    const filters=[`id.eq.${/^[0-9a-f-]{36}$/i.test(q)?q:'00000000-0000-4000-8000-000000000000'}`]
    if(q)filters.push(`stripe_payment_intent.ilike.%${q}%`)
    if(ids.length)filters.push(`delivery_id.in.(${ids.join(",")})`,`related_delivery_id.in.(${ids.join(",")})`)
    paymentQuery=paymentQuery.or(filters.join(","))
  }
  const from=parseAdminDate(params.from),to=parseAdminDate(params.to,true);if(from)paymentQuery=paymentQuery.gte('created_at',from);if(to)paymentQuery=paymentQuery.lt('created_at',to)
  const [payments,payouts,wallet]=await Promise.all([paymentQuery,admin.from('payouts').select('id,amount,status,payment_reference,created_at,processed_at').order('created_at',{ascending:false}).order('id').range((page-1)*50,page*50-1),admin.from('payments').select('amount',{count:'exact'}).eq('payment_method','wallet').eq('status','paid').limit(1000)])
  if (payments.error || payouts.error)
    throw new Error("Payment records could not load. Please retry.");
  const pounds=new Intl.NumberFormat("en-GB",{style:"currency",currency:"GBP"});
  const money = (v: unknown) => pounds.format(Number(v));
  return (
    <div className="p-4 md:p-8 text-white space-y-6">
      <h1 className="text-3xl font-bold">Payments</h1>
      <RecordFilters kind="payments" params={params} statuses={["pending","paid","failed"]}/>
      <CardPaymentsOverview />
      <section className="rounded-xl bg-[var(--brand-panel)] p-4"><h2 className="font-bold">Wallet payments</h2><p>{wallet.error || wallet.count==null || wallet.data?.length!==wallet.count ? "Total unavailable" : `${wallet.count} paid · ${money(wallet.data.reduce((sum,p)=>sum+Number(p.amount),0))} before refunds`}</p></section>
      <p>
        Payment records and payout records have separate states. Order status
        does not indicate whether money was received.
      </p>
      <h2 className="text-xl font-bold">Customer payments</h2>
      <div className="space-y-3">
        {payments.data.map((p) => (
          <div key={p.id} className="rounded-xl bg-[var(--brand-panel)] p-4">
            <strong>
              {money(p.amount)} — {p.status==="pending"&&p.payment_method==="stripe"?"Checkout awaiting confirmation":paymentDisplayStatus(p.status,p.amount,p.refund_jobs??[]).replaceAll("_"," ")}
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
            {p.payment_method==="stripe"&&p.stripe_session_id&&p.status==="pending"&&<PaymentReconcileButton id={p.id}/>}
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
