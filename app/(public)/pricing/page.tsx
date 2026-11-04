import type { Metadata } from "next"
import Link from "next/link"
import { getBookingPricing } from "@/app/actions/booking-settings"
import { getBfmSettings } from "@/app/actions/shopping"
import { calculateDeliveryFare } from "@/lib/booking-pricing"
import { createAdminClient } from "@/lib/supabase/admin"

export const dynamic = "force-dynamic"
export const metadata: Metadata = {
  title: "Delivery Pricing | GoDrop",
  description: "See how GoDrop works out UK delivery prices, shopping fees and any extra charges.",
}

const gbp = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" })
const money = (amount: number) => gbp.format(amount)

async function getBusyPricing() {
  const { data, error } = await createAdminClient().from("surge_pricing_settings")
    .select("master_enabled,traffic_enabled,demand_enabled").eq("id", true).single()
  return error ? null : data
}

export default async function PricingPage() {
  const [rates, shopping, busy] = await Promise.all([
    getBookingPricing().catch(() => null),
    getBfmSettings().catch(() => null),
    getBusyPricing().catch(() => null),
  ])
  const miles = rates ? rates.includedMiles + 3 : 0
  const example = rates ? calculateDeliveryFare(miles, rates, "small") : null
  return <section className="mx-auto max-w-5xl px-5 pt-28 pb-16">
    <h1 className="text-4xl sm:text-5xl font-bold mb-4">Delivery pricing</h1>
    <p className="text-[#adaaaa] mb-8">Pay for each booking in pounds. See your price before you pay.</p>
    <div className="grid gap-5 md:grid-cols-2">
      <article className="rounded-2xl bg-[#1a1919] border border-white/10 p-6">
        <h2 className="text-2xl font-semibold mb-4">Collect &amp; Deliver</h2>
        {rates ? <dl className="space-y-3">
          <div><dt className="text-[#adaaaa]">{rates.includedMiles ? `First ${rates.includedMiles} ${rates.includedMiles === 1 ? "mile" : "miles"}` : "Base delivery charge"}</dt><dd className="text-2xl font-bold">{money(rates.baseFare)}</dd></div>
          <div><dt className="text-[#adaaaa]">{rates.includedMiles ? "Each extra driving mile" : "Each driving mile"}</dt><dd>{money(rates.perMile)}</dd></div>
          <div><dt className="text-[#adaaaa]">Parcel size</dt><dd>Small and medium have no size fee. Large: {money(rates.largeFee)} extra. Bulky (van): {money(rates.vanFee)} extra.</dd></div>
          {rates.weatherFee > 0 && <div><dt className="text-[#adaaaa]">Current weather charge</dt><dd>{money(rates.weatherFee)}</dd></div>}
        </dl> : <p>Current rates are unavailable. Please try again shortly.</p>}
      </article>
      <article className="rounded-2xl bg-[#1a1919] border border-white/10 p-6">
        <h2 className="text-2xl font-semibold mb-4">Buy for Me</h2>
        {!shopping ? <p>Shopping settings are unavailable. Please try again shortly.</p> : !shopping.enabled ? <p>Buy for Me is currently unavailable.</p> : <>
          <p>Pay the delivery fare for a medium parcel{rates ? <> plus a <strong>{money(rates.shoppingFee)}</strong> shopping fee</> : " plus the shopping fee shown at checkout"}.</p>
          <p className="mt-3 text-[#adaaaa]">Checkout also charges {money(shopping.max_purchase_amount)} for shopping funds. Purchases are charged at the receipt price and unused funds are refunded to your payment card.</p>
        </>}
      </article>
    </div>
    {rates && example !== null && <div className="mt-5 rounded-2xl bg-[#1a1919] border border-white/10 p-6">
      <h2 className="text-xl font-semibold mb-2">Example: a {miles} mile delivery</h2>
      <p>A small parcel costs <strong>{money(example)}</strong>: {money(rates.baseFare)} base charge plus 3 extra miles at {money(rates.perMile)} per mile{rates.weatherFee > 0 ? `, plus the current ${money(rates.weatherFee)} weather charge` : ""}. This example does not include busy pricing, waiting or discounts.</p>
    </div>}
    <div className="mt-10 space-y-4">
      <h2 className="text-2xl font-semibold">Pricing questions</h2>
      <details className="rounded-xl bg-[#1a1919] p-4"><summary className="font-medium cursor-pointer">How is distance measured?</summary><p className="mt-2 text-[#adaaaa]">We use driving distance between your collection and delivery addresses. Extra distance is charged in proportion to the miles travelled, including part miles.</p></details>
      <details className="rounded-xl bg-[#1a1919] p-4"><summary className="font-medium cursor-pointer">Can traffic or demand affect my price?</summary><p className="mt-2 text-[#adaaaa]">{busy?.master_enabled === false ? "Busy pricing is currently off." : busy ? `Busy pricing is currently on. A busy period${busy.traffic_enabled ? ", heavy traffic" : ""}${busy.demand_enabled ? " or high demand" : ""} may affect the quote.` : "Your quote shows any extra charge that applies."} You see the full quote before you pay.</p></details>
      <details className="rounded-xl bg-[#1a1919] p-4"><summary className="font-medium cursor-pointer">What if the driver has to wait?</summary><p className="mt-2 text-[#adaaaa]">The first 5 minutes at collection are free. {rates ? rates.waitingPerMinute ? <>After that, your driver can request {money(rates.waitingPerMinute)} per minute for up to 60 billable minutes, subject to your approval and a support review.</> : "Waiting charge requests are currently off." : "If a waiting charge applies, you can review it before you pay."} Shopping time is not charged.</p></details>
      <Link className="inline-block rounded-lg bg-[var(--color-primary)] text-[var(--color-on-primary)] px-5 py-3 font-semibold" href="/dashboard/customer">Get a delivery quote</Link>
    </div>
  </section>
}
