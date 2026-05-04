import Image from "next/image"
import { getDriverDeliveries } from "@/app/actions/delivery"

export const dynamic = "force-dynamic"

export default async function ActiveJobsPage() {
  const { data: jobs, error } = await getDriverDeliveries("accepted")
  const job = jobs[0]

  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header */}
      <div className="mb-10 flex justify-between items-end">
        <div>
          <nav className="flex items-center gap-2 text-xs text-[#adaaaa] mb-2 uppercase tracking-widest font-semibold">
            <span>Fleet</span>
            <span className="material-symbols-outlined text-[10px]">
              chevron_right
            </span>
            <span className="text-[#a3a6ff]">Current Mission</span>
          </nav>
          <h2 className="text-2xl md:text-4xl font-black font-headline tracking-tighter text-white">
            Active Delivery {job?.tracking_number ? `#${job.tracking_number}` : ""}
          </h2>
        </div>
        <div className="flex flex-col items-end">
          <span className="text-xs text-[#adaaaa] font-medium mb-1">
            Time Elapsed
          </span>
          <span className="text-2xl font-mono font-bold text-[#a3a6ff] tabular-nums tracking-tighter">
            02:44:12
          </span>
        </div>
      </div>



      {error && (
        <div className="mb-6 rounded-xl border border-[#ff6e84]/30 bg-[#ff6e84]/10 px-4 py-3 text-sm text-[#ff6e84]">
          Failed to load active jobs: {error}
        </div>
      )}

      {!job && !error && (
        <div className="mb-6 rounded-xl border border-dashed border-[#494847]/30 bg-[#1a1919] px-6 py-8 text-center text-white">
          No active jobs right now.
        </div>
      )}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 md:gap-8">

        <div className="lg:col-span-8 space-y-6 md:space-y-8">
          {/* Main Workflow Card */}
          <section
            className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-4 md:p-8 border border-[#494847]/10"
            style={{ boxShadow: "0px 0px 15px rgba(163,166,255,0.15)" }}
          >
            {/* Progress */}
            <div className="relative flex justify-between mb-12 px-2">
              <div className="absolute top-1/2 left-0 w-full h-[2px] bg-[#494847]/20 -translate-y-1/2 z-0" />
              <div
                className="absolute top-1/2 left-0 w-[75%] h-[2px] bg-[#a3a6ff] -translate-y-1/2 z-0"
                style={{ boxShadow: "0px 0px 10px #a3a6ff" }}
              />
              {[
                { label: "Requested", done: true },
                { label: "Accepted", done: true },
                { label: "Collected", done: true },
                { label: "In Transit", active: true },
                { label: "Delivered", pending: true },
              ].map((step) => (
                <div
                  key={step.label}
                  className="relative z-10 flex flex-col items-center gap-3"
                >
                  {step.done && (
                    <div className="w-8 h-8 rounded-full bg-[#a3a6ff] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#0f00a4] text-sm">
                        check
                      </span>
                    </div>
                  )}
                  {step.active && (
                    <div className="w-8 h-8 rounded-full bg-[#1a1919] border-2 border-[#a3a6ff] flex items-center justify-center">
                      <div
                        className="w-2 h-2 rounded-full bg-[#c180ff] animate-pulse"
                        style={{ boxShadow: "0px 0px 10px #c180ff" }}
                      />
                    </div>
                  )}
                  {step.pending && (
                    <div className="w-8 h-8 rounded-full bg-[#1a1919] border-2 border-[#494847]/30" />
                  )}
                  <span
                    className={`text-[10px] font-bold uppercase tracking-wider ${
                      step.active
                        ? "text-[#a3a6ff]"
                        : step.pending
                          ? "text-[#adaaaa]/50"
                          : "text-[#adaaaa]"
                    }`}
                  >
                    {step.label}
                  </span>
                </div>
              ))}
            </div>

            {/* Addresses */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-12 pt-8 border-t border-[#494847]/10">
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a3a6ff] mb-3">
                    Pickup Address
                  </h4>
                  <div className="flex gap-4">
                    <span className="material-symbols-outlined text-[#c180ff] mt-1">
                      location_on
                    </span>
                    <div>
                      <p className="text-lg font-bold text-white leading-tight">
                        {job?.pickup_address || "—"}
                      </p>
                      <p className="text-sm text-[#adaaaa]">
                        {job?.item_description || "—"}
                      </p>
                      <p className="text-sm text-[#adaaaa]">{job?.status || "—"}</p>
                    </div>
                  </div>
                </div>
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a3a6ff] mb-3">
                    Customer Info
                  </h4>
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-xl bg-[#201f1f] flex items-center justify-center">
                      <span className="material-symbols-outlined text-white">
                        person
                      </span>
                    </div>
                    <div>
                      <p className="text-md font-bold text-white">
                        Sarah J. Wellington
                      </p>
                      <p className="text-xs text-[#adaaaa]">
                        Premium Priority Member
                      </p>
                    </div>
                    <button className="ml-auto w-10 h-10 rounded-full border border-[#494847]/20 flex items-center justify-center hover:bg-[#201f1f] transition-all text-white">
                      <span className="material-symbols-outlined text-sm">
                        phone
                      </span>
                    </button>
                  </div>
                </div>
              </div>
              <div className="space-y-6">
                <div>
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#a3a6ff] mb-3">
                    Delivery Address
                  </h4>
                  <div className="flex gap-4">
                    <span className="material-symbols-outlined text-[#a3a6ff] mt-1">
                      local_shipping
                    </span>
                    <div>
                      <p className="text-lg font-bold text-white leading-tight">
                        {job?.delivery_address || "—"}
                      </p>
                      <p className="text-sm text-[#adaaaa]">
                        808 Neon Street, Penthouse Floor
                      </p>
                      <p className="text-sm text-[#adaaaa]">Austin, TX 78702</p>
                    </div>
                  </div>
                </div>
                <div className="bg-[#131313] p-4 rounded-xl border border-[#494847]/5">
                  <h4 className="text-[10px] font-bold uppercase tracking-widest text-[#adaaaa] mb-2">
                    Special Instructions
                  </h4>
                  <p className="text-sm italic text-white leading-relaxed">
                    {
                      '"Gate code: 4492. Please leave at the secure freight elevator and call upon arrival. Fragile items inside."'
                    }
                  </p>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex items-center gap-4 mt-12 pt-8 border-t border-[#494847]/10">
              <button className="flex-1 py-4 px-6 rounded-xl bg-[#201f1f] border border-[#494847]/20 text-white font-bold text-sm flex items-center justify-center gap-2 hover:bg-[#262626] transition-all cursor-not-allowed opacity-50">
                <span className="material-symbols-outlined text-sm">
                  task_alt
                </span>
                Mark as Picked Up
              </button>
              <button
                className="flex-1 py-4 px-6 rounded-xl bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm flex items-center justify-center gap-2 hover:opacity-90 transition-all active:scale-95"
                style={{ boxShadow: "0px 10px 20px rgba(163,166,255,0.2)" }}
              >
                <span className="material-symbols-outlined text-sm">
                  check_circle
                </span>
                Mark as Delivered
              </button>
            </div>
          </section>

          {/* Proof of Delivery */}
          <section className="bg-[#1a1919] rounded-xl p-4 md:p-8 border border-[#494847]/10">
            <div className="flex justify-between items-center mb-6">
              <div>
                <h3 className="text-xl font-bold font-headline text-white">
                  Upload Proof of Delivery
                </h3>
                <p className="text-sm text-[#adaaaa]">
                  High-resolution photos required for completion
                </p>
              </div>
              <span className="text-[10px] font-bold py-1 px-3 bg-[#c180ff]/10 text-[#c180ff] rounded-full border border-[#c180ff]/20 uppercase tracking-tighter">
                Required
              </span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 md:gap-6">
              <div className="aspect-video rounded-xl border-2 border-dashed border-[#494847]/30 flex flex-col items-center justify-center gap-3 hover:bg-[#201f1f] transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-[#131313] flex items-center justify-center text-[#adaaaa] group-hover:text-[#a3a6ff] transition-colors">
                  <span className="material-symbols-outlined">
                    add_a_photo
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#adaaaa]">
                  Front View
                </p>
              </div>
              <div className="aspect-video rounded-xl overflow-hidden relative group">
                <Image
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuBE7X-CRCZ6AFX4pKRSyZGtiJy_7w_hCjNvfPlhLBfH6cMxhaldHGUN5o9gl5dPYCtDLuaYhlo_IgixvM7Oehk_ULZPhjj-N0a2KdeV10wDXesu8SAqbPQN3fHYxzJOu6ZIPOoP1DngGqcBfRMcrZqZyGza3GJ16eMXoLOPCc2TwdNDU65E2rX197Csi-Hbp29cGphvNc25iQZT4UDxg99yg6YmBJ6leW65KeOMclHoeaMAGU1kavF-YfQDGju9aa_oxkr8IzbANA"
                  alt="Uploaded package photo"
                  fill
                  className="object-cover grayscale opacity-50 group-hover:grayscale-0 group-hover:opacity-100 transition-all"
                  unoptimized
                />
                <div className="absolute inset-0 bg-[#0e0e0e]/60 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity">
                  <button className="p-2 bg-[#ff6e84] text-[#490013] rounded-full">
                    <span className="material-symbols-outlined text-sm">
                      delete
                    </span>
                  </button>
                </div>
                <div className="absolute bottom-2 left-2 px-2 py-1 bg-[#a3a6ff] text-[#0f00a4] text-[10px] font-bold rounded">
                  UPLOADED
                </div>
              </div>
              <div className="aspect-video rounded-xl border-2 border-dashed border-[#494847]/30 flex flex-col items-center justify-center gap-3 hover:bg-[#201f1f] transition-all cursor-pointer group">
                <div className="w-10 h-10 rounded-full bg-[#131313] flex items-center justify-center text-[#adaaaa] group-hover:text-[#a3a6ff] transition-colors">
                  <span className="material-symbols-outlined">
                    add_a_photo
                  </span>
                </div>
                <p className="text-xs font-semibold text-[#adaaaa]">
                  Signature/ID
                </p>
              </div>
            </div>
          </section>
        </div>

        {/* Right Column */}
        <div className="lg:col-span-4 space-y-6 md:space-y-8">
          {/* Map Card */}
          <section className="h-80 rounded-xl overflow-hidden relative border border-[#494847]/10 shadow-xl">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBDwM56UIy1PJV2FyvrwLu0CfFtMUhdy6C2gl2ePOFxYDObF-EB_okjNeGEvrQgx9uQxrrUSkWtLDoh2Cunv7gMVbVwp1k2L7r81pRFqthrChw5vJm6jGvSFzdPFTFIBi6pScUZwHew-w5OrJZrRROn_8B_jpxqaqM5_ybNy4w-jK3mypPtRUO6bNrrZs2m3RAJj2MzshHLzy7rD8wQcX6WZ1WTiMGZaUakoYDDoDH2O78e4f3TL3Kp-7RNKJFdwrePLFilMhHOcw"
              alt="Live delivery map"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute top-4 right-4 flex flex-col gap-2">
              <button className="w-10 h-10 bg-[#262626]/80 backdrop-blur-lg rounded-lg flex items-center justify-center text-white border border-white/10 hover:bg-[#262626] transition-all">
                <span className="material-symbols-outlined">my_location</span>
              </button>
              <button className="w-10 h-10 bg-[#262626]/80 backdrop-blur-lg rounded-lg flex items-center justify-center text-white border border-white/10 hover:bg-[#262626] transition-all">
                <span className="material-symbols-outlined">map</span>
              </button>
            </div>
            <div className="absolute bottom-0 left-0 right-0 p-4 bg-gradient-to-t from-[#0e0e0e] to-transparent">
              <div className="bg-[#0e0e0e]/80 backdrop-blur-md p-3 rounded-lg border border-[#494847]/10 flex items-center gap-3">
                <div className="p-2 bg-[#c180ff]/20 rounded text-[#c180ff]">
                  <span className="material-symbols-outlined text-sm">
                    navigation
                  </span>
                </div>
                <div>
                  <p className="text-xs font-bold text-white">
                    808 Neon Street
                  </p>
                  <p className="text-[10px] text-[#adaaaa]">
                    ETA: 8 min • 2.1 km away
                  </p>
                </div>
              </div>
            </div>
          </section>

          {/* Package Details */}
          <section className="bg-[#1a1919] rounded-xl p-6 border border-[#494847]/10 space-y-4">
            <h3 className="text-sm font-bold font-headline text-white">
              Package Details
            </h3>
            {[
              { label: "Cargo Type", value: "Quantum Processors" },
              { label: "Weight", value: "45 kg" },
              { label: "Dimensions", value: "80×60×40 cm" },
              { label: "Value", value: "$12,400" },
              { label: "Insurance", value: "Full Coverage" },
            ].map((item) => (
              <div
                key={item.label}
                className="flex justify-between text-xs border-b border-[#494847]/10 pb-2 last:border-0"
              >
                <span className="text-[#adaaaa]">{item.label}</span>
                <span className="text-white font-bold">{item.value}</span>
              </div>
            ))}
          </section>

          {/* Emergency Actions */}
          <section className="bg-[#1a1919] rounded-xl p-6 border border-[#494847]/10 space-y-3">
            <h3 className="text-sm font-bold font-headline text-white mb-4">
              Emergency Actions
            </h3>
            <button className="w-full flex items-center justify-between p-4 bg-[#262626] hover:bg-[#a70138]/20 group transition-all rounded-lg border border-[#494847]/5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#ff6e84] group-hover:scale-110 transition-transform">
                  cancel
                </span>
                <span className="font-semibold text-sm text-white">
                  Cancel Delivery
                </span>
              </div>
              <span className="material-symbols-outlined text-[#adaaaa] text-sm">
                chevron_right
              </span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-[#262626] hover:bg-[#c180ff]/10 group transition-all rounded-lg border border-[#494847]/5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#c180ff] group-hover:rotate-12 transition-transform">
                  report
                </span>
                <span className="font-semibold text-sm text-white">
                  Report Incident
                </span>
              </div>
              <span className="material-symbols-outlined text-[#adaaaa] text-sm">
                chevron_right
              </span>
            </button>
            <button className="w-full flex items-center justify-between p-4 bg-[#262626] hover:bg-[#a3a6ff]/10 group transition-all rounded-lg border border-[#494847]/5">
              <div className="flex items-center gap-3">
                <span className="material-symbols-outlined text-[#a3a6ff] group-hover:-translate-y-1 transition-transform">
                  contact_support
                </span>
                <span className="font-semibold text-sm text-white">
                  Live Dispatch Chat
                </span>
              </div>
              <span className="material-symbols-outlined text-[#adaaaa] text-sm">
                chevron_right
              </span>
            </button>
          </section>
        </div>
      </div>
    </div>
  )
}
