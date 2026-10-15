export const dynamic = 'force-dynamic'
import { readLaunchSettings } from '@/lib/launch-settings'
export default async function DriverAgreement() {
  const s = await readLaunchSettings()
  return (
    <main className="max-w-3xl mx-auto p-6 text-white space-y-5">
      <h1 className="text-3xl font-bold">GoDrop driver fee agreement</h1>
      <p>
        The current standard split is {100 - s.commissionPercent}% for the
        driver and {s.commissionPercent}% for GoDrop. It applies only to
        delivery and shopping service fees, after the customer’s displayed
        promotional discount. The cost of shopping items is excluded.
      </p>
      <p>
        The current minimum payment is £{s.minimumDriverDelivery.toFixed(2)} for
        Collect &amp; Deliver and £{s.minimumDriverShopping.toFixed(2)} for Buy
        for Me. A minimum payment can reduce GoDrop’s commission or require a
        platform subsidy.
      </p>
      <p>
        Before accepting, review the exact driver amount, route, vehicle
        requirement, items and estimated time. The accepted job’s quote is
        saved. Later changes to pricing do not change that saved amount.
      </p>
      <p>
        Completed, verified jobs enter the weekly payment batch. A verified
        Stripe payment account is required. Your statement separates service
        fees, driver earnings, commission and any subsidy. Bank arrival times
        depend on Stripe and your bank; an initiated transfer is not a guarantee
        of same-day bank receipt.
      </p>
      <p>
        Buy for Me drivers must use the GoDrop-funded purchase method. Do not
        use personal money. Wait for customer approval of substitutions or
        higher prices, stay within the funded limit, and upload the shop
        receipt. Report unavailable items or shop delays through the order’s
        problem controls. Shopping time is not billed.
      </p>
      <p>
        For ordinary collection waiting, the first {s.freeWaitingMinutes}{' '}
        minutes are free. A further charge requires a clear customer-approved
        rule and payment confirmation. Do not add charges yourself. Your job and
        payment statement must record any authorised change.
      </p>
      <p>
        This fee agreement describes GoDrop’s payment arrangement. Full driver
        service terms, insurance requirements, cancellation compensation and
        dispute procedures still need the business’s final review before launch.
      </p>
    </main>
  )
}
