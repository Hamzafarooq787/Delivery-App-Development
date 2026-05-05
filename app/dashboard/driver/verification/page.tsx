import { createClient } from "@/lib/supabase/server"

type DocStatus = "approved" | "pending" | "rejected"

function statusBadge(s: DocStatus) {
  if (s === "approved") return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-500/10 text-green-400 rounded-full text-[11px] font-bold uppercase tracking-wider">
      <span className="w-1.5 h-1.5 rounded-full bg-green-400 animate-pulse" />Approved
    </div>
  )
  if (s === "rejected") return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#a70138]/20 text-[#ff6e84] rounded-full text-[11px] font-bold uppercase tracking-wider">
      <span className="material-symbols-outlined text-sm">error</span>Rejected
    </div>
  )
  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-[#201f1f] text-[#adaaaa] rounded-full text-[11px] font-bold uppercase tracking-wider">
      <span className="material-symbols-outlined text-sm">schedule</span>Pending Review
    </div>
  )
}

export default async function VerificationPage() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  let driverStatus: "pending" | "approved" | "rejected" = "pending"
  if (user) {
    const { data } = await supabase
      .from("driver_profiles")
      .select("status")
      .eq("id", user.id)
      .single()
    if (data?.status) driverStatus = data.status as "pending" | "approved" | "rejected"
  }

  const pct = driverStatus === "approved" ? 100 : driverStatus === "rejected" ? 33 : 33
  const docStatus: DocStatus = driverStatus === "approved" ? "approved" : driverStatus === "rejected" ? "rejected" : "pending"
  const needsAction = driverStatus !== "approved"

  return (
    <div className="pt-2 pb-12 px-2">
      <div className="mb-8 md:mb-10">
        <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white mb-2">
          Driver Verification
        </h2>
        <p className="text-[#adaaaa] max-w-2xl leading-relaxed">
          Ensure your operational compliance by keeping your logistics credentials updated. Documents are typically reviewed within 24 hours of submission.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        {/* Status Overview */}
        <div className="md:col-span-4 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-xl flex flex-col justify-between border border-[#494847]/15">
          <div>
            <p className="text-xs font-semibold tracking-widest text-[#a3a6ff] uppercase mb-4">Overall Status</p>
            <div className="flex items-baseline gap-2">
              <span className="text-4xl md:text-5xl font-black font-headline text-white">{pct}%</span>
              <span className="text-[#adaaaa]">Complete</span>
            </div>
            <div className="mt-3">
              <span className={`inline-block px-3 py-1 rounded-full text-xs font-bold uppercase tracking-wider ${
                driverStatus === "approved" ? "bg-green-500/10 text-green-400" :
                driverStatus === "rejected" ? "bg-[#a70138]/20 text-[#ff6e84]" :
                "bg-[#a3a6ff]/10 text-[#a3a6ff]"
              }`}>
                {driverStatus === "approved" ? "Verified" : driverStatus === "rejected" ? "Action Required" : "Under Review"}
              </span>
            </div>
          </div>
          <div className="mt-8">
            <div className="w-full h-1.5 bg-[#1a1919] rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full ${driverStatus === "approved" ? "bg-green-400" : "bg-[#a3a6ff]"}`}
                style={{ width: `${pct}%`, boxShadow: "0px 0px 15px rgba(163,166,255,0.2)" }}
              />
            </div>
            <p className="text-xs text-[#adaaaa] mt-3 italic">
              {driverStatus === "approved"
                ? "All documents verified. You are fully operational."
                : driverStatus === "rejected"
                ? "One or more documents require re-submission."
                : "Your documents are being reviewed by our team."}
            </p>
          </div>
        </div>

        {/* Identity Verification */}
        <div className="md:col-span-8 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-5 md:p-8 rounded-xl flex flex-col md:flex-row gap-6 md:gap-8 items-start md:items-center overflow-hidden relative border border-[#494847]/15">
          <div className="flex-1 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#a3a6ff]/20 flex items-center justify-center text-[#a3a6ff]">
                <span className="material-symbols-outlined">badge</span>
              </div>
              <h3 className="text-xl font-bold font-headline text-white">Identity Verification</h3>
            </div>
            <p className="text-[#adaaaa] text-sm leading-relaxed">
              Upload a high-resolution scan of your Passport or Commercial Driver&apos;s License. Ensure all four corners are visible and text is legible.
            </p>
            <div className="flex items-center gap-4 pt-4">
              <button className="px-6 py-2.5 bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm rounded-lg active:scale-95 transition-all flex items-center gap-2" style={{ boxShadow: "0px 0px 15px rgba(163,166,255,0.2)" }}>
                <span className="material-symbols-outlined text-sm">upload</span>
                Upload Document
              </button>
              {statusBadge(docStatus)}
            </div>
          </div>
          <div className="w-full md:w-64 h-40 bg-[#1a1919] rounded-lg border border-[#494847]/10 flex items-center justify-center">
            <span className="material-symbols-outlined text-4xl text-[#494847]">description</span>
          </div>
        </div>

        {/* Insurance Policy */}
        <div className="md:col-span-6 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-5 md:p-8 rounded-xl space-y-5 md:space-y-6 border border-[#494847]/15">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-[#6f00be]/20 flex items-center justify-center text-[#c180ff]">
              <span className="material-symbols-outlined">shield</span>
            </div>
            {statusBadge(docStatus)}
          </div>
          <div>
            <h3 className="text-xl font-bold font-headline text-white mb-2">Insurance Policy</h3>
            <p className="text-[#adaaaa] text-sm">Upload your current active commercial insurance certificate.</p>
          </div>
          {driverStatus === "rejected" && (
            <div className="p-4 bg-[#a70138]/10 border-l-2 border-[#ff6e84] rounded-r-lg">
              <p className="text-xs text-[#ff6e84] font-medium">Please re-upload your insurance documents for review.</p>
            </div>
          )}
          <button className="w-full py-3 bg-[#201f1f] border border-[#494847]/30 text-white font-bold text-sm rounded-lg hover:bg-[#262626] transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">refresh</span>
            {driverStatus === "rejected" ? "Re-upload Policy" : "Upload Policy"}
          </button>
        </div>

        {/* Vehicle Registration */}
        <div className="md:col-span-6 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-5 md:p-8 rounded-xl space-y-5 md:space-y-6 border border-[#494847]/15">
          <div className="flex justify-between items-start">
            <div className="w-12 h-12 rounded-xl bg-[#a3a6ff]/20 flex items-center justify-center text-[#a3a6ff]">
              <span className="material-symbols-outlined">commute</span>
            </div>
            {statusBadge(docStatus)}
          </div>
          <div>
            <h3 className="text-xl font-bold font-headline text-white mb-2">Vehicle Registration</h3>
            <p className="text-[#adaaaa] text-sm">Official registration documents for your primary logistics vehicle.</p>
          </div>
          <button className="w-full py-3 bg-[#201f1f] border border-[#494847]/30 text-white font-bold text-sm rounded-lg hover:bg-[#262626] transition-all flex items-center justify-center gap-2">
            <span className="material-symbols-outlined text-sm">upload</span>
            Upload Registration
          </button>
        </div>

        {/* Support Banner */}
        <div className="md:col-span-12 mt-4">
          <div className="relative overflow-hidden rounded-2xl bg-[#1a1919] border border-[#494847]/10 p-1">
            <div className="absolute top-0 right-0 w-64 h-64 bg-[#a3a6ff]/10 blur-[80px] -mr-32 -mt-32 rounded-full pointer-events-none" />
            <div className="relative flex flex-col md:flex-row items-start md:items-center justify-between p-5 md:p-8 gap-5 md:gap-6">
              <div className="flex items-center gap-6">
                <div className="w-16 h-16 rounded-full bg-[#201f1f] flex items-center justify-center">
                  <span className="material-symbols-outlined text-[#a3a6ff] text-3xl">support_agent</span>
                </div>
                <div>
                  <h4 className="text-lg font-bold text-white">Having trouble with verification?</h4>
                  <p className="text-[#adaaaa] text-sm">Our compliance specialists are available 24/7 to assist with document formatting and regional requirements.</p>
                </div>
              </div>
              <a href="/dashboard/driver/support" className="px-8 py-3 bg-[#262626] text-white font-bold text-sm rounded-lg hover:bg-[#2c2c2c] transition-all whitespace-nowrap">
                Open Support Ticket
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
