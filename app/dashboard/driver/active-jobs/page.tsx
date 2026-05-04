import { getDriverDeliveries } from "@/app/actions/delivery"

export const dynamic = "force-dynamic"

export default async function ActiveJobsPage() {
  const { data: jobs, error } = await getDriverDeliveries("accepted")

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end justify-between md:gap-6">
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white mb-2 font-headline">
            Active Jobs
          </h1>
          <p className="text-[#adaaaa] font-medium">
            {jobs.length === 0
              ? "No active jobs right now."
              : `${jobs.length} accepted job${jobs.length === 1 ? "" : "s"} in progress.`}
          </p>
        </div>
      </div>

      {error && (
        <div className="mb-6 rounded-xl border border-[#ff6e84]/30 bg-[#ff6e84]/10 px-4 py-3 text-sm text-[#ff6e84]">
          Failed to load active jobs: {error}
        </div>
      )}

      {jobs.length === 0 && !error ? (
        <div className="rounded-xl border border-dashed border-[#494847]/30 bg-[#1a1919] px-6 py-16 text-center">
          <p className="text-lg font-semibold text-white">No active jobs</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-6">
          {jobs.map((job) => (
            <div
              key={job.id}
              className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/10 rounded-xl p-6"
            >
              <div className="space-y-3">
                <div>
                  <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">Pickup Address</p>
                  <p className="text-sm font-semibold text-white break-words">{job.pickup_address || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">Delivery Address</p>
                  <p className="text-sm font-semibold text-white break-words">{job.delivery_address || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">Item Description</p>
                  <p className="text-sm font-semibold text-white break-words">{job.item_description || "—"}</p>
                </div>
                <div>
                  <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">Status</p>
                  <p className="text-sm font-semibold text-[#a3a6ff] uppercase">{job.status || "—"}</p>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
