import { getAvailableDeliveries } from "@/app/actions/delivery"
import { AcceptJobButton } from "@/components/driver/accept-job-button"

export const dynamic = "force-dynamic"

function formatDate(value: string | null) {
  if (!value) return "—"
  try {
    return new Date(value).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    })
  } catch {
    return value
  }
}

function formatPrice(value: number | null) {
  if (value == null) return null
  return new Intl.NumberFormat(undefined, {
    style: "currency",
    currency: "USD",
  }).format(value)
}

export default async function AvailableJobsPage() {
  const { data: jobs, error } = await getAvailableDeliveries()

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="mb-8 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end justify-between md:gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white mb-2 font-headline">
            Available Jobs
          </h1>
          <p className="text-[#adaaaa] font-medium">
            {jobs.length === 0
              ? "No unassigned delivery requests right now."
              : `${jobs.length} unassigned delivery ${
                  jobs.length === 1 ? "request" : "requests"
                } ready to accept.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ff6e84]/30 bg-[#ff6e84]/10 px-4 py-3 text-sm text-[#ff6e84]">
          Failed to load jobs: {error}
        </div>
      )}

      {jobs.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-[#494847]/30 bg-[#1a1919] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">
            No available jobs at the moment
          </p>
          <p className="mt-2 text-sm text-[#adaaaa]">
            Check back shortly &mdash; new delivery requests will appear here as
            soon as customers post them.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job) => {
            const price = formatPrice(job.price as number | null)
            return (
              <div
                key={job.id}
                className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/10 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:bg-[#1a1919] transition-all duration-300"
              >
                <div className="flex-1 space-y-6">
                  <div className="flex justify-between items-start gap-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center">
                        <span className="material-symbols-outlined text-[#a3a6ff]">
                          inventory_2
                        </span>
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-lg font-bold text-white truncate">
                          {job.item_description || "Delivery request"}
                        </h3>
                        <p className="text-xs text-[#adaaaa]">
                          Posted {formatDate(job.created_at as string | null)}
                          {job.tracking_number ? ` • ${job.tracking_number}` : ""}
                        </p>
                      </div>
                    </div>
                    {price && (
                      <div className="text-right shrink-0">
                        <span className="text-2xl font-black text-[#a3a6ff] font-headline tracking-tighter">
                          {price}
                        </span>
                        <p className="text-[10px] text-[#adaaaa] uppercase font-bold">
                          Estimated Payout
                        </p>
                      </div>
                    )}
                  </div>

                  <div className="flex items-start gap-4">
                    <div className="flex flex-col items-center pt-1">
                      <div className="w-3 h-3 rounded-full border-2 border-[#a3a6ff] bg-[#0e0e0e]" />
                      <div className="w-px h-10 border-l border-dashed border-[#494847] my-1" />
                      <div className="w-3 h-3 rounded-full bg-[#c180ff]" />
                    </div>
                    <div className="flex-1 space-y-4 min-w-0">
                      <div>
                        <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">
                          Pickup Address
                        </p>
                        <p className="text-sm font-semibold text-white break-words">
                          {job.pickup_address || "—"}
                        </p>
                      </div>
                      <div>
                        <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">
                          Delivery Address
                        </p>
                        <p className="text-sm font-semibold text-white break-words">
                          {job.delivery_address || "—"}
                        </p>
                      </div>
                    </div>
                  </div>
                </div>

                <div className="md:w-px bg-[#494847]/10" />

                <div className="md:w-48 flex flex-col justify-between gap-4">
                  <div className="space-y-3">
                    <div className="flex justify-between text-xs">
                      <span className="text-[#adaaaa]">Created</span>
                      <span className="text-white font-bold">
                        {formatDate(job.created_at as string | null)}
                      </span>
                    </div>
                    {job.item_value != null && (
                      <div className="flex justify-between text-xs">
                        <span className="text-[#adaaaa]">Item Value</span>
                        <span className="text-white font-bold">
                          {formatPrice(job.item_value as number) ?? "—"}
                        </span>
                      </div>
                    )}
                    <div className="flex justify-between text-xs">
                      <span className="text-[#adaaaa]">Status</span>
                      <span className="text-[#a3a6ff] font-bold uppercase">
                        {job.status}
                      </span>
                    </div>
                  </div>
                  <AcceptJobButton deliveryId={job.id as string} />
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
