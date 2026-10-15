import { getDriverDeliveries } from "@/app/actions/delivery"
import Link from "next/link"

export const dynamic = "force-dynamic"

const ACTIVE_STATUSES = ["accepted", "collected", "in_transit"]

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

function statusLabel(status: string) {
  return status.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
}

function statusColor(status: string) {
  if (status === "accepted") return "text-[var(--brand-soft)]"
  if (status === "collected") return "text-[var(--color-secondary)]"
  if (status === "in_transit") return "text-[#6ee7b7]"
  return "text-[var(--color-on-surface-variant)]"
}

export default async function ActiveJobsPage() {
  const { data: allJobs, error } = await getDriverDeliveries()
  const jobs = (allJobs ?? []).filter((j: any) =>
    ACTIVE_STATUSES.includes(j.status)
  )

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end justify-between md:gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white mb-2 font-headline">
            Active Jobs
          </h1>
          <p className="text-[var(--color-on-surface-variant)] font-medium">
            {jobs.length === 0
              ? "No active jobs right now."
              : `${jobs.length} active ${jobs.length === 1 ? "delivery" : "deliveries"} in progress.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ff6e84]/30 bg-[#ff6e84]/10 px-4 py-3 text-sm text-[#ff6e84]">
          Failed to load jobs: {error}
        </div>
      )}

      {jobs.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-[var(--color-outline-variant)]/30 bg-[var(--brand-panel)] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">No active jobs</p>
          <p className="mt-2 text-sm text-[var(--color-on-surface-variant)]">
            Accept an available job to see it here.
          </p>
          <Link
            href="/dashboard/driver/jobs/available"
            className="mt-6 inline-block bg-[var(--brand-strong)] text-[var(--brand-ink)] font-bold text-xs px-6 py-2.5 rounded-lg"
            style={{ boxShadow: "0px 0px 15px rgba(var(--brand-rgb),0.2)" }}
          >
            Browse Available Jobs
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job: any) => (
            <div
              key={job.id}
              className="bg-[var(--brand-panel)] backdrop-blur-xl border border-[var(--color-outline-variant)]/10 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:bg-[var(--brand-panel)] transition-all duration-300"
            >
              <div className="flex-1 space-y-6">
                <div className="flex justify-between items-start gap-4">
                  <div className="flex items-center gap-3">
                    <div className="w-10 h-10 rounded-lg bg-[var(--color-surface-container-highest)] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[var(--brand-soft)]">
                        local_shipping
                      </span>
                    </div>
                    <div className="min-w-0">
                      <h3 className="text-lg font-bold text-white truncate">
                        {job.item_description || "Delivery"}
                      </h3>
                      <p className="text-xs text-[var(--color-on-surface-variant)]">
                        Accepted {formatDate(job.updated_at as string | null)}
                        {` • ${job.tracking_number ?? `KV-${job.id.slice(0, 8).toUpperCase()}`}`}
                      </p>
                    </div>
                  </div>
                  <span className={`text-xs font-bold uppercase ${statusColor(job.status)}`}>
                    {statusLabel(job.status)}
                  </span>
                </div>

                <div className="flex items-start gap-4">
                  <div className="flex flex-col items-center pt-1">
                    <div className="w-3 h-3 rounded-full border-2 border-[var(--brand-strong)] bg-[var(--brand-bg)]" />
                    <div className="w-px h-10 border-l border-dashed border-[var(--color-outline-variant)] my-1" />
                    <div className="w-3 h-3 rounded-full bg-[var(--color-secondary)]" />
                  </div>
                  <div className="flex-1 space-y-4 min-w-0">
                    <div>
                      <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold leading-none">
                        Pickup
                      </p>
                      <p className="text-sm font-semibold text-white break-words">
                        {job.pickup_address || "—"}
                      </p>
                    </div>
                    <div>
                      <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold leading-none">
                        Delivery
                      </p>
                      <p className="text-sm font-semibold text-white break-words">
                        {job.delivery_address || "—"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="md:w-px bg-[var(--color-outline-variant)]/10" />

              <div className="md:w-48 flex flex-col justify-between gap-4">
                <div className="space-y-3">
                  <div className="flex justify-between text-xs">
                    <span className="text-[var(--color-on-surface-variant)]">Created</span>
                    <span className="text-white font-bold">
                      {formatDate(job.created_at as string | null)}
                    </span>
                  </div>
                  {job.price != null && (
                    <div className="flex justify-between text-xs">
                      <span className="text-[var(--color-on-surface-variant)]">Payout</span>
                      <span className="text-[var(--brand-soft)] font-bold">
                        {new Intl.NumberFormat(undefined, {
                          style: "currency",
                          currency: "USD",
                        }).format(job.price)}
                      </span>
                    </div>
                  )}
                </div>
                <Link
                  href={`/dashboard/driver/jobs/${job.id}`}
                  className="w-full py-2.5 bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/30 text-white font-bold text-sm rounded-lg text-center hover:bg-[var(--color-surface-container-highest)] transition-all"
                >
                  View Details
                </Link>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}

