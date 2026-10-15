import Link from 'next/link'
import { createClient } from '@/lib/supabase/server'
import { getStripe } from '@/lib/stripe/server'
import { fulfillBooking } from '@/lib/booking-fulfillment'
export default async function BookingConfirmation({
  searchParams,
}: {
  searchParams: Promise<{ session_id?: string; cancelled?: string }>
}) {
  const params = await searchParams,
    client = await createClient(),
    {
      data: { user },
    } = await client.auth.getUser()
  let order: {
      id: string
      tracking_number: string | null
      status: string
    } | null = null,
    message = 'Your payment was not completed. No job has been dispatched.'
  if (user && params.session_id) {
    try {
      const session = await getStripe().checkout.sessions.retrieve(
        params.session_id,
      )
      if (session.metadata?.customer_id !== user.id) throw new Error()
      order = await fulfillBooking(session.id)
      message =
        order.status === 'cancelled'
          ? 'This booking was cancelled. Your payment is being refunded.'
          : 'Your booking is confirmed.'
    } catch {
      message =
        'Payment confirmation is still pending. Please check My Deliveries. Do not pay again.'
    }
  }
  return (
    <main className="mx-auto max-w-lg p-6 text-white">
      <section className="rounded-2xl bg-[#242424] border border-gray-500 p-6 space-y-5">
        <h1 className="text-3xl font-bold">
          {order && order.status !== 'cancelled'
            ? 'Thank you!'
            : 'Booking payment'}
        </h1>
        <p>{message}</p>
        {order && (
          <div className="rounded-xl bg-[#333] p-4">
            <p>Tracking code</p>
            <strong className="font-mono break-all">
              {order.tracking_number}
            </strong>
          </div>
        )}
        <div className="flex flex-wrap gap-3">
          {order && order.status !== 'cancelled' && (
            <Link
              className="rounded-xl bg-[var(--color-primary)] text-black p-3 font-bold"
              href={`/dashboard/customer/tracking?id=${order.id}`}
            >
              Track delivery
            </Link>
          )}
          <Link
            className="rounded-xl border border-gray-400 p-3"
            href="/dashboard/customer/active-deliveries"
          >
            My Deliveries
          </Link>
          <Link
            className="rounded-xl border border-gray-400 p-3"
            href="/dashboard/customer"
          >
            Home
          </Link>
        </div>
      </section>
    </main>
  )
}
