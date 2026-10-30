import { createAdminClient } from "@/lib/supabase/admin";
import { createClient } from "@/lib/supabase/server";
export async function ShoppingItemsHistory({ orderId }: { orderId: string }) {
  const session = await createClient();
  const {
    data: { user },
  } = await session.auth.getUser();
  if (!user) return null;
  const { data: profile } = await session
    .from("users")
    .select("role")
    .eq("id", user.id)
    .single();
  if (profile?.role !== "admin") return null;
  const db = createAdminClient();
  const [timeline, items, decisions] = await Promise.all([
    db
      .from("delivery_requests")
      .select("shopping_timeline")
      .eq("id", orderId)
      .single(),
    db
      .from("shopping_items")
      .select("*")
      .eq("delivery_id", orderId)
      .order("created_at"),
    db
      .from("shopping_substitutions")
      .select("*")
      .eq("delivery_id", orderId)
      .order("created_at"),
  ]);
  if (items.error || decisions.error || timeline.error)
    return (
      <p role="alert">
        Shopping item history could not load. Refresh to retry.
      </p>
    );
  return (
    <section className="rounded-xl bg-[var(--brand-panel)] p-5 space-y-4">
      <h2 className="font-bold text-lg">Shopping items and decisions</h2>
      {items.data.map((i) => (
        <div key={i.id} className="border-b border-white/10 pb-3">
          <p>
            {i.quantity} × {i.name ?? i.item_name} — {i.status}
          </p>
          {i.photo_url?.startsWith("https://") && (
            <a
              className="underline"
              target="_blank"
              rel="noopener noreferrer"
              href={i.photo_url}
            >
              Requested item photo
            </a>
          )}
          <p>
            Estimated unit price: £{Number(i.estimated_price ?? 0).toFixed(2)} ·
            Confirmed:{" "}
            {i.confirmed_unit_price == null
              ? "Not confirmed"
              : `£${Number(i.confirmed_unit_price).toFixed(2)}`}
          </p>
          {decisions.data
            .filter((d) => d.shopping_item_id === i.id)
            .map((d) => (
              <p key={d.id} className="text-sm py-1">
                {d.photo_url?.startsWith("https://") && (
                  <a
                    className="underline mr-2"
                    target="_blank"
                    rel="noopener noreferrer"
                    href={d.photo_url}
                  >
                    Replacement photo
                  </a>
                )}
                {d.suggested_name} — £
                {Number(d.suggested_price ?? 0).toFixed(2)} —{" "}
                {d.customer_approved === null
                  ? "Awaiting customer"
                  : d.customer_approved
                    ? "Approved"
                    : "Rejected"}
                {d.customer_responded_at
                  ? ` · ${new Date(d.customer_responded_at).toLocaleString("en-GB", { timeZone: "Europe/London" })}`
                  : ""}
              </p>
            ))}
        </div>
      ))}
      <h3 className="font-bold">Shopping timeline</h3>
      {(timeline.data?.shopping_timeline ?? []).map(
        (
          e: { at: string; stage: string; problem: unknown; driver_id: string },
          index: number,
        ) => (
          <p key={index} className="text-sm">
            {new Date(e.at).toLocaleString("en-GB", {
              timeZone: "Europe/London",
            })}{" "}
            — {e.stage?.replaceAll("_", " ")}
            {e.problem ? " · Shop problem recorded" : ""} · Driver{" "}
            {e.driver_id ?? "Unassigned"}
          </p>
        ),
      )}
    </section>
  );
}
