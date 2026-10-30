import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
import { redirect } from "next/navigation";
import { OrderStatusChart } from "@/components/admin/order-status-chart";
export default async function AdminReportsPage() {
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const { data, error } = await createAdminClient().rpc(
    "admin_report_snapshot",
    { p_actor: user.id },
  );
  if (error || !data) throw new Error("Reports could not load. Please retry.");
  const money = (v: number) =>
    new Intl.NumberFormat("en-GB", {
      style: "currency",
      currency: "GBP",
    }).format(v);
  const stats = [
    ["Orders (30 days)", data.orders],
    ["Completed service fees (30 days)", money(data.serviceFees)],
    ["Driver earnings (30 days)", money(data.driverEarnings)],
    ["GoDrop commission before costs (30 days)", money(data.commission)],
    ["Approved drivers online", data.activeDrivers],
    ["New customers (30 days)", data.newCustomers],
  ];
  return (
    <div className="p-4 md:p-8 text-white space-y-6">
      <h1 className="text-3xl font-bold">Reports</h1>
      <p>
        Last 30 days. Completed service fees exclude shopping goods. Commission
        can be negative where GoDrop subsidises minimum earnings. See Payments
        for refunds and processing costs.
      </p>
      <div className="grid grid-cols-2 lg:grid-cols-3 gap-4">
        {stats.map(([label, value]) => (
          <div className="rounded-xl bg-[var(--brand-panel)] p-5" key={label}>
            <p className="text-sm">{label}</p>
            <strong className="text-2xl">{value}</strong>
          </div>
        ))}
      </div>
      <p>Orders in the previous 30-day period: {data.previousOrders}</p>
      <OrderStatusChart data={data.statuses} />
      <h2 className="text-xl font-bold">Top drivers by completed deliveries</h2>
      <div className="rounded-xl bg-[var(--brand-panel)] p-5">
        {data.topDrivers.length ? (
          data.topDrivers.map(
            (d: { id: string; full_name: string; completed: number }) => (
              <p key={d.id} className="py-2">
                {d.full_name || "Driver"} — {d.completed} completed
              </p>
            ),
          )
        ) : (
          <p>No completed deliveries in this period.</p>
        )}
      </div>
    </div>
  );
}
