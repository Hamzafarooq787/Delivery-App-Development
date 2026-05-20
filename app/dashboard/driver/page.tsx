import { createClient } from "@/lib/supabase/server"
import Image from "next/image"
import Link from "next/link"

export default async function DriverDashboard() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [jobsRes, earningsRes] = await Promise.all([
    supabase
      .from("delivery_requests")
      .select("*")
      .eq("driver_id", user?.id ?? "")
      .order("created_at", { ascending: false }),
    supabase
      .from("driver_earnings")
      .select("amount, commission_amount, status")
      .eq("driver_id", user?.id ?? ""),
  ])

  const jobs = jobsRes.data ?? []
  const totalEarnings =
    earningsRes.data?.reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0
  const pendingEarnings =
    earningsRes.data?.filter(e => e.status === "pending").reduce((sum, e) => sum + (e.amount ?? 0), 0) ?? 0
  const activeJobs = jobs.filter((j) =>
    ["accepted", "collected", "picked_up", "in_transit"].includes(j.status)
  ).length
  const completedJobs = jobs.filter((j) => j.status === "delivered").length
  const recentActivity = jobs.slice(0, 3)

  return (
  <div className="pt-2 pb-12 px-2">
    {/* Header */}
    <header className="mb-8 md:mb-10">
      <h2 className="text-2xl md:text-3xl font-black font-headline tracking-tighter text-white">
        Dashboard
      </h2>
      <p className="text-[#adaaaa] font-medium mt-1">
        Real-time logistics performance and active ops.
      </p>
    </header>

    {/* Bento Grid */}
    <div className="grid grid-cols-1 md:grid-cols-12 gap-4 md:gap-6">
      {/* Earnings Card */}
      <div className="md:col-span-4 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-5 md:p-8 flex flex-col justify-between border border-[#494847]/15 hover:bg-[#201f1f] transition-all group">
          <div>
            <div className="flex items-center justify-between mb-4">
              <span className="text-xs font-bold uppercase tracking-widest text-[#a3a6ff]">
                Revenue Today
              </span>
              <span
                className="material-symbols-outlined text-[#a3a6ff]"
                style={{ fontVariationSettings: "'FILL' 1" }}
              >
                payments
              </span>
            </div>
            <h3 className="text-4xl md:text-5xl font-black font-headline tracking-tighter text-white mb-2">
              £{totalEarnings > 0 ? totalEarnings.toFixed(2) : "0.00"}
            </h3>
            <p className="text-xs text-[#adaaaa] flex items-center gap-1">
              <span className="text-[#a3a6ff] font-bold">All time · your 75% share</span>
            </p>
            {pendingEarnings > 0 && (
              <p className="text-xs text-[#c180ff] mt-1 font-bold">
                £{pendingEarnings.toFixed(2)} pending withdrawal
              </p>
            )}
          </div>
          <div className="mt-8 h-12 w-full bg-black/30 rounded flex items-end gap-1 p-2">
            <div className="flex-1 bg-[#a3a6ff]/20 h-4 rounded-sm"></div>
            <div className="flex-1 bg-[#a3a6ff]/20 h-6 rounded-sm"></div>
            <div className="flex-1 bg-[#a3a6ff]/20 h-3 rounded-sm"></div>
            <div className="flex-1 bg-[#a3a6ff]/20 h-8 rounded-sm"></div>
            <div className="flex-1 bg-[#a3a6ff]/40 h-10 rounded-sm"></div>
            <div className="flex-1 bg-[#a3a6ff]/60 h-7 rounded-sm"></div>
            <div
              className="flex-1 bg-[#a3a6ff] h-9 rounded-sm"
              style={{ boxShadow: "0px 0px 10px rgba(163,166,255,0.4)" }}
            ></div>
          </div>
        </div>

      {/* Stats Cards Column */}
      <div className="md:col-span-3 grid grid-cols-2 md:grid-cols-1 gap-4 md:gap-6">
          <div className="flex-1 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-6 hover:bg-[#201f1f] transition-all border border-[#494847]/15">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#c180ff]/10 flex items-center justify-center">
                <span className="material-symbols-outlined text-[#c180ff] text-lg">
                  local_shipping
                </span>
              </div>
              <span className="text-xs font-bold text-[#adaaaa]">
                Completed Jobs
              </span>
            </div>
            <div className="text-4xl font-black font-headline text-white">
              {String(completedJobs).padStart(2, "0")}
            </div>
          </div>
          <div className="flex-1 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-6 hover:bg-[#201f1f] transition-all border-l-4 border-[#c180ff]">
            <div className="flex items-center gap-3 mb-2">
              <div className="w-8 h-8 rounded-lg bg-[#c180ff]/20 flex items-center justify-center">
                <span
                  className="material-symbols-outlined text-[#c180ff] text-lg animate-pulse"
                  style={{ fontVariationSettings: "'FILL' 1" }}
                >
                  radar
                </span>
              </div>
              <span className="text-xs font-bold text-[#c180ff]">
                Active Jobs
              </span>
            </div>
            <div className="text-4xl font-black font-headline text-white">
              {String(activeJobs).padStart(2, "0")}
            </div>
          </div>
        </div>

      {/* Active Map Fragment */}
      <div className="md:col-span-5 relative rounded-xl overflow-hidden bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/15 group min-h-[220px] md:min-h-[300px]">
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuA4gQyry9h81vqsFnspcq3X1Q1ZwbK-FtYMmFr8Rrz-kmla893fw9bVfdPAYDf7n72uazhdT5U5YSI26qz4WqU3lnTWcIUNeXOZIKvzZQOJYO8GtWEJMsKpfgSoVPCCO8qEBlUKXqubCinxsUnvV1PrigqkLl8nc49EnuGT_URTfeX7zscwERnv_yjv97J2_SpC_mAsmGoAjaCza0uzwJHs159VTU-srl7vTJyXlxGnRNkALdggwdng1fcXRDVVRkK7JXHrq6N5DA"
            alt="Active Job Map Tracking"
            fill
            className="object-cover opacity-60 grayscale hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
            unoptimized
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent" />
          <div className="absolute bottom-6 left-6 right-6 flex items-center justify-between">
            <div>
              <p className="text-[10px] uppercase tracking-widest font-bold text-[#adaaaa] mb-1">
                Current Route
              </p>
              <p className="text-sm font-bold text-white">
                Sector 7 → Port Terminal B
              </p>
            </div>
            <Link
              href="/dashboard/driver/active-jobs"
              className="bg-[#a3a6ff] text-[#0f00a4] px-4 py-2 rounded font-bold text-xs"
              style={{ boxShadow: "0px 0px 10px rgba(163,166,255,0.4)" }}
            >
              Open Maps
            </Link>
          </div>
        </div>

        {/* Recent Activity List */}
        <div className="lg:col-span-8 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-4 md:p-8 border border-[#494847]/15">
          <div className="flex items-center justify-between mb-4 md:mb-8">
            <h4 className="text-lg font-bold font-headline text-white">
              Recent Activity
            </h4>
            <Link
              href="/dashboard/driver/active-jobs"
              className="text-xs font-bold text-[#a3a6ff] hover:underline"
            >
              View History
            </Link>
          </div>
          <div className="space-y-4">
            {recentActivity.length === 0 ? (
              <>
                {[
                  {
                    label: "Delivery Completed",
                    sub: "Oakland Distribution Hub • KV-8821",
                    amount: "+$42.00",
                    time: "14:22 PM",
                    icon: "check_circle",
                    color: "text-[#a3a6ff]",
                  },
                  {
                    label: "Delivery Completed",
                    sub: "South Pier Warehouse • KV-8819",
                    amount: "+$28.50",
                    time: "12:15 PM",
                    icon: "check_circle",
                    color: "text-[#a3a6ff]",
                  },
                  {
                    label: "New Job Assigned",
                    sub: "Priority Express: Sector 7",
                    amount: "Awaiting",
                    time: "09:45 AM",
                    icon: "info",
                    color: "text-[#c180ff]",
                    amountColor: "text-[#c180ff]",
                  },
                ].map((item, i) => (
                  <div
                    key={i}
                    className="flex items-center justify-between p-4 rounded-lg bg-[#1a1919]/50 hover:bg-[#1a1919] transition-all"
                  >
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-full bg-[#1a1919] flex items-center justify-center">
                        <span
                          className={`material-symbols-outlined ${item.color}`}
                        >
                          {item.icon}
                        </span>
                      </div>
                      <div>
                        <p className="text-sm font-bold text-white">
                          {item.label}
                        </p>
                        <p className="text-xs text-[#adaaaa]">{item.sub}</p>
                      </div>
                    </div>
                    <div className="text-right">
                      <p
                        className={`text-sm font-bold ${item.amountColor ?? "text-white"}`}
                      >
                        {item.amount}
                      </p>
                      <p className="text-[10px] text-[#adaaaa]">{item.time}</p>
                    </div>
                  </div>
                ))}
              </>
            ) : (
              recentActivity.map((job) => (
                <div
                  key={job.id}
                  className="flex items-center justify-between p-4 rounded-lg bg-[#1a1919]/50 hover:bg-[#1a1919] transition-all"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-[#1a1919] flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#a3a6ff]">
                        local_shipping
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">
                        {job.tracking_number}
                      </p>
                      <p className="text-xs text-[#adaaaa]">
                        {job.pickup_address}
                      </p>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="text-sm font-bold text-white capitalize">
                      {job.status}
                    </p>
                    <p className="text-[10px] text-[#adaaaa]">
                      {new Date(job.created_at).toLocaleDateString()}
                    </p>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>

        {/* Driver Performance Card */}
        <div className="lg:col-span-4 flex flex-col gap-4 md:gap-6">
          <div
            className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl rounded-xl p-4 md:p-8 border-t-2 border-[#a3a6ff]"
            style={{
              background:
                "linear-gradient(to bottom right, rgba(163,166,255,0.1), transparent)",
            }}
          >
            <h4 className="text-xs font-bold text-[#a3a6ff] uppercase tracking-widest mb-6">
              Driver Tier: Elite
            </h4>
            <div className="flex items-end justify-between mb-2">
              <span className="text-sm font-bold text-white">
                Reliability Score
              </span>
              <span className="text-2xl font-black text-white">98%</span>
            </div>
            <div className="w-full bg-[#1a1919] h-2 rounded-full mb-8">
              <div
                className="bg-[#a3a6ff] h-full w-[98%] rounded-full"
                style={{ boxShadow: "0px 0px 10px rgba(163,166,255,0.4)" }}
              ></div>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="p-3 bg-[#1a1919]/30 rounded">
                <p className="text-[10px] text-[#adaaaa] font-bold uppercase">
                  Avg Transit
                </p>
                <p className="text-lg font-bold text-white">24 min</p>
              </div>
              <div className="p-3 bg-[#1a1919]/30 rounded">
                <p className="text-[10px] text-[#adaaaa] font-bold uppercase">
                  Rating
                </p>
                <p className="text-lg font-bold text-white">4.96</p>
              </div>
            </div>
          </div>

          {/* CTA Promo */}
          <div className="relative rounded-xl overflow-hidden min-h-[140px] flex items-center p-5 md:p-8">
            <Image
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuDiGXMQQi74HOHj5uNpLYnRBdZYewqb-vyfLCHqcg9CPKGvF1PolF1Rkc_s6b8pylGknkPc8QNLt0DMzKe6CT3ULjlyAgwGCTz4C7RqK3gyS-ZAeKUKLrVgykWXvNazBEEqZZbUphl-ssiw39GArB2Moc8RU5JYb6ES8AX-bWLQ_bXkx9WKZpHNr32FnYGH9H0PpgFcMbWQ089I2GjcIeJrV14haGJHDWIDQxC8D7s7sYSmb69eVHbCW_dFwL529P45EvHbqmNwTw"
              alt="Fleet Upgrade"
              fill
              className="object-cover"
              unoptimized
            />
            <div className="absolute inset-0 bg-[#c180ff]/80 mix-blend-multiply" />
            <div className="relative z-10">
              <p className="text-xs font-black uppercase tracking-tighter text-white mb-1">
                Fleet Upgrade Available
              </p>
              <h5 className="text-xl font-black text-white leading-tight mb-4">
                Master the Void. Unlock Class-A hauls.
              </h5>
              <button className="bg-white text-[#9c48ea] px-6 py-2 rounded-full font-bold text-xs transition-transform active:scale-95">
                Upgrade Now
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
