import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
export async function NeedsAttention() {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;
  const db = createAdminClient();
  const { data: p } = await session
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (p?.role !== "admin") return null;
  const { data, error } = await db.rpc("admin_attention_queue", {
    p_actor: user.id,
  });
  if (error)
    return <p role="alert">Attention queue could not load. Please refresh.</p>;
  return (
    <section className="m-4 rounded-xl bg-[var(--brand-panel)] p-5 text-white">
      <h2 className="font-bold text-lg">Needs attention</h2>
      <p className="text-xs mb-3">
        Up to 100 oldest open issues. Entries clear when the underlying issue is
        resolved; payment and shopping history stays on the order.
      </p>
      {!data.length ? (
        <p>No open issues in the monitored checks.</p>
      ) : (
        data.map((r: { id: string; reason: string; at: string }, i: number) => (
          <p key={`${r.id}-${i}`} className="py-2 border-t border-white/10">
            <Link
              className="underline"
              href={`/dashboard/admin/orders/${r.id}`}
            >
              {r.reason}
            </Link>{" "}
            ·{" "}
            {new Date(r.at).toLocaleString("en-GB", {
              timeZone: "Europe/London",
            })}
          </p>
        ))
      )}
    </section>
  );
}
