import "server-only";
import { getStripe } from "@/lib/stripe/server";
/** Dedicated card only: reconcile captured purchases plus uncaptured authorizations. */
export async function verifyCompanyReceipt(
  cardId: string | null,
  approved: number,
  receipt: number,
) {
  if (
    !cardId ||
    !Number.isFinite(approved) ||
    approved < 0 ||
    Math.round(approved * 100) !== Math.round(receipt * 100)
  )
    throw new Error("Basket/receipt mismatch");
  const stripe = getStripe();
  let spent = 0,
    held = 0;
  for await (const t of stripe.issuing.transactions.list({
    card: cardId,
    limit: 100,
  })) {
    if (t.currency !== "gbp") throw new Error("Unexpected currency");
    spent -= t.amount;
  }
  for await (const a of stripe.issuing.authorizations.list({
    card: cardId,
    status: "pending",
    limit: 100,
  })) {
    if (a.currency !== "gbp") throw new Error("Unexpected currency");
    const captured = a.transactions
      .filter((t) => t.type === "capture")
      .reduce((sum, t) => sum - t.amount, 0);
    if (a.approved) held += Math.max(0, a.amount - captured);
  }
  if (spent + held !== Math.round(receipt * 100))
    throw new Error("Company purchase not confirmed");
  await stripe.issuing.cards.update(cardId, { status: "inactive" });
}
