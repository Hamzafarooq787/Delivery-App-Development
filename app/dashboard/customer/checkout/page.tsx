import { ClearCompletedBookingDraft } from "@/components/customer/pending-order-checkouts";
import Link from "next/link";
import {
  getCheckoutOutcome,
  resumeOrderCheckout,
} from "@/app/actions/order-checkout";
export const dynamic = "force-dynamic";
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{
    session_id?: string;
    canceled?: string;
    payment_id?: string;
  }>;
}) {
  const params = await searchParams;
  const resume =
    params.canceled && params.payment_id
      ? await resumeOrderCheckout(params.payment_id)
      : null;
  const result = params.session_id
    ? await getCheckoutOutcome(params.session_id)
    : null;
  return (
    <main className="mx-auto max-w-lg p-6 text-white">
      <h1 className="text-2xl font-bold">
        {result && "data" in result
          ? "Thank you — your order is confirmed"
          : params.canceled
            ? "Payment was not completed"
            : "Confirming your payment"}
      </h1>
      {result && "data" in result && result.data ? (
        <>
          <ClearCompletedBookingDraft
            kind={result.data.service_type ?? "delivery"}
          />
          <p className="my-4">
            Tracking code: <strong>{result.data.tracking_number}</strong>
          </p>
          <Link
            href={`/dashboard/customer/tracking?id=${result.data.id}`}
            className="block rounded-xl bg-[var(--brand-strong)] p-4"
          >
            Track your order
          </Link>
        </>
      ) : (
        <>
          <p className="my-4">
            {result?.error ??
              "Your order has not been dispatched. You can return to your saved form and try again."}
          </p>
          {params.session_id && (
            <Link
              href={`/dashboard/customer/checkout?session_id=${encodeURIComponent(params.session_id)}`}
            >
              Refresh payment status
            </Link>
          )}
        </>
      )}
      {resume?.url && (
        <Link
          href={resume.url}
          className="block rounded-xl bg-[var(--brand-strong)] p-4"
        >
          Continue saved checkout
        </Link>
      )}
      {resume?.error && <p role="alert">{resume.error}</p>}
      <Link href="/dashboard/customer" className="mt-6 block">
        Back to dashboard
      </Link>
    </main>
  );
}
