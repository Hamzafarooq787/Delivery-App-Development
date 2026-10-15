import Link from "next/link"
import { notFound, redirect } from "next/navigation"
import { adminApproveDriver, adminRejectDriver, adminGetDriverById } from "@/app/actions/delivery"
import { getDriverDocumentsById } from "@/app/actions/documents"
import { adminGetDriverVehicles } from "@/app/actions/vehicles"
import { DriverDocumentsPanel } from "@/components/admin/driver-documents-panel"
import { VEHICLE_INFO } from "@/lib/vehicles"

function fmtDate(v: string) {
  if (!v) return "—"
  return new Date(v).toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })
}

function fmt(v: number) {
  return new Intl.NumberFormat(undefined, { style: "currency", currency: "USD" }).format(v)
}

function StatusPill({ status }: { status: string }) {
  if (status === "approved")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-green-500/10 text-green-400 border border-green-500/20">
        <span className="w-1.5 h-1.5 rounded-full bg-green-400" />Approved
      </span>
    )
  if (status === "rejected")
    return (
      <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[#ff6e84]/10 text-[#ff6e84] border border-[#ff6e84]/20">
        <span className="w-1.5 h-1.5 rounded-full bg-[#ff6e84]" />Rejected
      </span>
    )
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-bold bg-[var(--brand-strong)]/10 text-[var(--brand-soft)] border border-[var(--brand-strong)]/20">
      <span className="w-1.5 h-1.5 rounded-full bg-[var(--brand-strong)] animate-pulse" />Pending Review
    </span>
  )
}

export default async function AdminDriverDetailPage({
  params,
}: {
  params: Promise<{ driverId: string }>
}) {
  const { driverId } = await params
  const [{ data: driver, error }, documents, vehicles] = await Promise.all([
    adminGetDriverById(driverId),
    getDriverDocumentsById(driverId),
    adminGetDriverVehicles(driverId),
  ])

  if (error || !driver) notFound()

  const initials = driver.full_name
    .split(" ").map((p: string) => p[0]).join("").slice(0, 2).toUpperCase() || "DR"

  async function approve() {
    "use server"
    await adminApproveDriver(driverId)
    redirect(`/dashboard/admin/drivers/${driverId}`)
  }

  async function reject() {
    "use server"
    await adminRejectDriver(driverId)
    redirect(`/dashboard/admin/drivers/${driverId}`)
  }

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Back + Header */}
      <div className="flex items-center gap-3 mb-8 md:mb-10">
        <Link
          href="/dashboard/admin/drivers"
          className="flex items-center justify-center w-9 h-9 rounded-xl bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 text-[var(--color-on-surface-variant)] hover:text-white transition-colors"
        >
          <span className="material-symbols-outlined text-lg">arrow_back</span>
        </Link>
        <div>
          <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white font-headline">
            {driver.full_name}
          </h1>
          <p className="text-[var(--color-on-surface-variant)] mt-0.5">Driver profile and submitted documents.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column */}
        <div className="lg:col-span-2 flex flex-col gap-6">
          {/* Profile card */}
          <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <div className="w-14 h-14 rounded-full bg-[var(--brand-strong)]/10 border border-[var(--brand-strong)]/20 flex items-center justify-center shrink-0">
                <span className="text-lg font-bold text-[var(--brand-soft)]">{initials}</span>
              </div>
              <div className="min-w-0">
                <p className="text-base font-bold text-white">{driver.full_name}</p>
                <p className="text-xs text-[var(--color-on-surface-variant)] mt-0.5">{driver.email || "No email"}</p>
              </div>
              <div className="ml-auto"><StatusPill status={driver.status ?? "pending"} /></div>
            </div>

            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Personal Info</p>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
              {[
                { label: "Phone", value: driver.phone ?? "—" },
                { label: "Joined", value: fmtDate(driver.created_at) },
                { label: "Jobs Completed", value: String(driver.jobsCompleted) },
                { label: "Total Earned", value: fmt(driver.totalEarned) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <p className="text-[10px] text-[var(--color-on-surface-variant)] uppercase font-bold mb-1">{label}</p>
                  <p className="text-sm font-semibold text-white">{value}</p>
                </div>
              ))}
            </div>
          </div>

          {/* Vehicles card */}
          <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[var(--brand-soft)]">directions_car</span>
              <p className="text-sm font-bold text-white">Vehicles</p>
              <span className="ml-auto text-xs text-[var(--color-on-surface-variant)]">{vehicles.length} registered</span>
            </div>
            {vehicles.length === 0 ? (
              <p className="text-xs text-[var(--color-on-surface-variant)]">No vehicles registered.</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {vehicles.map((v) => (
                  <div key={v.id} className="flex items-start gap-2.5 bg-[var(--brand-bg)] border border-[var(--color-outline-variant)]/15 rounded-lg px-3 py-2.5">
                    <span className="text-base shrink-0">{VEHICLE_INFO[v.vehicle_type].emoji}</span>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-white truncate">
                        {VEHICLE_INFO[v.vehicle_type].label}
                        {(v.make || v.model) && <span className="text-[var(--color-on-surface-variant)] font-normal"> — {[v.make, v.model].filter(Boolean).join(" ")}</span>}
                      </p>
                      <p className="text-[10px] text-[var(--color-on-surface-variant)] truncate">
                        {[v.colour, v.registration_number].filter(Boolean).join(" · ") || "No details"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Documents card */}
          <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-6">
            <div className="flex items-center gap-2 mb-5">
              <span className="material-symbols-outlined text-[var(--brand-soft)]">folder_open</span>
              <p className="text-sm font-bold text-white">Submitted Documents</p>
              <span className="ml-auto text-xs text-[var(--color-on-surface-variant)]">{documents.length} file{documents.length !== 1 ? "s" : ""}</span>
            </div>
            <DriverDocumentsPanel documents={documents} />
          </div>
        </div>

        {/* Right column */}
        <div className="flex flex-col gap-5">
          {/* Verification actions */}
          <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Verification</p>
            <div className="mb-4"><StatusPill status={driver.status ?? "pending"} /></div>
            {documents.length === 0 && (
              <p className="text-xs text-[var(--color-on-surface-variant)] bg-[var(--color-surface-container-highest)] rounded-xl px-4 py-3 mb-4">
                Driver has not uploaded any documents yet.
              </p>
            )}
            <div className="flex flex-col gap-2">
              <form action={approve}>
                <button
                  type="submit"
                  disabled={driver.status === "approved"}
                  className="w-full py-2.5 rounded-xl bg-green-500/10 border border-green-500/20 text-green-400 font-bold text-sm hover:bg-green-500/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">check_circle</span>
                  Approve Driver
                </button>
              </form>
              <form action={reject}>
                <button
                  type="submit"
                  disabled={driver.status === "rejected"}
                  className="w-full py-2.5 rounded-xl bg-[#ff6e84]/10 border border-[#ff6e84]/20 text-[#ff6e84] font-bold text-sm hover:bg-[#ff6e84]/20 transition-all disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                >
                  <span className="material-symbols-outlined text-sm">cancel</span>
                  Reject Driver
                </button>
              </form>
            </div>
          </div>

          {/* Earnings summary */}
          <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Earnings Summary</p>
            <div className="space-y-3">
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-on-surface-variant)]">Total Earned</span>
                <span className="text-sm font-bold text-[var(--brand-soft)]">{fmt(driver.totalEarned)}</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-[var(--color-on-surface-variant)]">Jobs Completed</span>
                <span className="text-sm font-bold text-white">{driver.jobsCompleted}</span>
              </div>
            </div>
          </div>

          {/* Quick links */}
          <div className="bg-[var(--brand-panel)] border border-[var(--color-outline-variant)]/15 rounded-xl p-5">
            <p className="text-[10px] font-bold text-[var(--color-on-surface-variant)] uppercase tracking-widest mb-4">Quick Links</p>
            <div className="flex flex-col gap-2">
              <Link
                href="/dashboard/admin/verification"
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-white rounded-xl text-xs font-semibold transition-all"
              >
                <span className="material-symbols-outlined text-sm">verified_user</span>
                Verification Queue
              </Link>
              <Link
                href="/dashboard/admin/drivers"
                className="flex items-center gap-2 px-4 py-2.5 bg-[var(--color-surface-container-highest)] border border-[var(--color-outline-variant)]/20 text-[var(--color-on-surface-variant)] hover:text-white rounded-xl text-xs font-semibold transition-all"
              >
                <span className="material-symbols-outlined text-sm">badge</span>
                All Drivers
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

