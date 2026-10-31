import { CheckoutConfirmation } from "@/components/customer/checkout-confirmation";
import Link from "next/link";
import {
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
  return (
    <main className="mx-auto max-w-lg p-6 text-white">
      {params.session_id ? <CheckoutConfirmation sessionId={params.session_id}/> : <><h1 className="text-2xl font-bold">{params.canceled ? 'Payment was not completed' : 'Payment reference missing'}</h1><p className="my-4">Your order has not been dispatched. Continue your payment below or return to the dashboard.</p></>}
      {resume?.url && (
        <Link
          href={resume.url}
          className="block rounded-xl bg-[var(--brand-strong)] p-4"
        >
          Continue payment
        </Link>
      )}
      {resume?.error && <p role="alert">{resume.error}</p>}
      <Link href="/dashboard/customer" className="mt-6 block">
        Back to dashboard
      </Link>
    </main>
  );
}
