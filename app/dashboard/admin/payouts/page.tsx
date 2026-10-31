import {getAdminActor} from "@/lib/admin-access"
import { AutomaticPayoutsControl } from "@/components/admin/automatic-payouts-control";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { redirect } from "next/navigation";
import Link from "next/link";
import { AdminPayoutsPanel } from "@/components/admin/admin-payouts-panel";
export default async function AdminPayoutsPage({
  searchParams,
}: {
  searchParams: Promise<{ page?: string }>;
}) {
  if(!(await getAdminActor("finance")))return <p className="p-6 text-white">Finance permission is required.</p>
  const db = await createClient();
  const {
    data: { user },
  } = await db.auth.getUser();
  if (!user) redirect("/login");
  const q = await searchParams;
  const page = Math.max(1, Math.min(100000, Math.floor(Number(q.page) || 1)));
  const { data, error } = await createAdminClient().rpc(
    "admin_payout_snapshot",
    { p_actor: user.id, p_page: page },
  );
  if (error || !data)
    throw new Error("Payout data could not load. Please retry.");
  const settings = await createAdminClient().from("surge_pricing_settings").select("automatic_payouts").order("id").limit(1).single();
  if (settings.error) throw new Error("Payout settings could not load.");
  return (
    <>
      <AutomaticPayoutsControl enabled={settings.data.automatic_payouts} webhookConfigured={Boolean(process.env.STRIPE_CONNECT_WEBHOOK_SECRET)} />
      <p className="px-8 pt-4 text-white text-sm">
        Weekly payout requests reserve earnings. Manual payments require a bank reference; Stripe payments are reconciled automatically. Totals cover all
        records; lists show up to 100 per page.
      </p>
      <AdminPayoutsPanel {...data} />
      <nav className="flex gap-6 px-8 pb-6 text-white">
        {page > 1 && <Link href={`?page=${page - 1}`}>Previous</Link>}
        {(data.payouts.length === 100 ||
          data.pendingDrivers.length === 100) && (
          <Link href={`?page=${page + 1}`}>Next</Link>
        )}
      </nav>
    </>
  );
}
