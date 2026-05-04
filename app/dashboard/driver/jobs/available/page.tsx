import Image from "next/image"

const jobs = [
  {
    id: "KV-4821",
    tag: "Priority",
    tagColor: "bg-[#a3a6ff]/10 text-[#a3a6ff]",
    payout: "$58.50",
    icon: "inventory_2",
    iconColor: "text-[#a3a6ff]",
    name: "Quantum Processors",
    subtitle: "Fragile • Tech Electronics",
    pickup: "Tech District – Warehouse 402",
    dropoff: "Neo-Marina Waterfront Towers",
    distance: "12.4 km",
    time: "24 mins",
    weight: "45 kg",
  },
  {
    id: "KV-4834",
    tag: "Express",
    tagColor: "bg-[#262626] text-[#adaaaa]",
    payout: "$24.00",
    icon: "electric_bolt",
    iconColor: "text-[#c180ff]",
    name: "Express Courier Service",
    subtitle: "Urban Fast",
    pickup: "Central Station Mall",
    dropoff: "South Hills Residences",
    distance: "4.8 km",
    time: "12 mins",
    weight: "2.1 kg",
  },
  {
    id: "KV-4855",
    tag: "High Value",
    tagColor: "bg-[#c180ff]/10 text-[#c180ff]",
    payout: "$112.00",
    icon: "medical_services",
    iconColor: "text-[#ffa5d9]",
    name: "Cryo-Medical Supplies",
    subtitle: "Priority • Temperature Controlled",
    pickup: "Bio-Labs Research Plaza",
    dropoff: "Central Medical District, Pod 4",
    distance: "34.2 km",
    time: "55 mins",
    weight: "8 kg",
  },
]

export default function AvailableJobsPage() {
  return (
  <div className="pt-2 pb-12 px-2">
    {/* Header */}
    <div className="mb-8 md:mb-10 flex flex-col gap-4 md:flex-row md:items-end justify-between md:gap-6">
      <div>
        <h1 className="text-2xl md:text-4xl font-extrabold tracking-tighter text-white mb-2 font-headline">
          Available Jobs
        </h1>
        <p className="text-[#adaaaa] font-medium">
          14 active delivery opportunities in your current sector.
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2 md:gap-3">
          <div className="bg-[#201f1f] rounded-full px-4 py-2 flex items-center gap-3 border border-[#494847]/10">
            <span className="text-xs font-semibold text-[#adaaaa]">
              Distance:
            </span>
            <select className="bg-transparent border-none text-xs font-bold text-[#a3a6ff] p-0 focus:ring-0 cursor-pointer">
              <option>All Distances</option>
              <option>{"< 5 km"}</option>
              <option>5 - 15 km</option>
              <option>15+ km</option>
            </select>
          </div>
          <div className="bg-[#201f1f] rounded-full px-4 py-2 flex items-center gap-3 border border-[#494847]/10">
            <span className="text-xs font-semibold text-[#adaaaa]">
              Min. Price:
            </span>
            <select className="bg-transparent border-none text-xs font-bold text-[#a3a6ff] p-0 focus:ring-0 cursor-pointer">
              <option>$10.00</option>
              <option>$25.00</option>
              <option>$50.00</option>
              <option>$100.00</option>
            </select>
          </div>
          <button className="p-2 bg-[#201f1f] hover:bg-[#262626] rounded-lg border border-[#494847]/10 transition-colors">
            <span className="material-symbols-outlined text-sm text-white">
              tune
            </span>
          </button>
        </div>
      </div>

      {/* Bento Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Map Preview */}
        <div className="lg:col-span-4 lg:row-span-2 rounded-xl overflow-hidden bg-[#1a1919] relative group min-h-[260px] md:min-h-[400px]">
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent to-transparent z-10" />
          <div className="absolute top-6 left-6 z-20">
            <div className="bg-[#0e0e0e]/80 backdrop-blur-md p-3 rounded-xl border border-[#494847]/10">
              <p className="text-[10px] font-bold text-[#a3a6ff] uppercase tracking-widest mb-1">
                Current Sector
              </p>
              <p className="text-sm font-bold text-white">
                Neo-Industrial Zone 4
              </p>
            </div>
          </div>
          <Image
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCmye7xCPQMqAOVkDHzLPC9a9uzyAnDoslybOu_GFkHJq--c6mMLMfnQytwOGRJwtAbTdHpbxSCHhuqPcQ9J_if4tf54DlFsf3Ua00N1NbPOF3iIhkPLNVYroyqCvI3tD_hnNX-uq6HwuOVAA8b1VAdb-KFZuXlTLLu4y8vDbiD3Hx9p9ylol6d5p_g328vKdR1cM7RBKlQrxFy2TYyGRR2-0t2ISmxnCJrL2HQwzE8u_pmftaTYfqiIYRZnAYnc-h0Qhxl5PDiLw"
            alt="Sector Map View"
            fill
            className="object-cover opacity-60 grayscale group-hover:grayscale-0 transition-all duration-700 scale-105 group-hover:scale-100"
            unoptimized
          />
          <div className="absolute bottom-6 left-6 right-6 z-20">
            <div className="bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 backdrop-blur-xl p-4 rounded-xl">
              <div className="flex items-center justify-between">
                <span className="text-xs text-white">
                  Active Couriers nearby
                </span>
                <span className="text-lg font-black text-[#a3a6ff]">14</span>
              </div>
            </div>
          </div>
        </div>

        {/* Job Cards */}
        {jobs.map((job) => (
          <div
            key={job.id}
            className="lg:col-span-8 bg-[rgba(38,38,38,0.6)] backdrop-blur-xl border border-[#494847]/10 rounded-xl p-6 flex flex-col md:flex-row gap-6 hover:bg-[#1a1919] transition-all duration-300"
          >
            <div className="flex-1 space-y-6">
              <div className="flex justify-between items-start">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center">
                    <span
                      className={`material-symbols-outlined ${job.iconColor}`}
                    >
                      {job.icon}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-lg font-bold text-white">{job.name}</h3>
                    <p className="text-xs text-[#adaaaa]">{job.subtitle}</p>
                  </div>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-black text-[#a3a6ff] font-headline tracking-tighter">
                    {job.payout}
                  </span>
                  <p className="text-[10px] text-[#adaaaa] uppercase font-bold">
                    Estimated Payout
                  </p>
                </div>
              </div>

              <div className="flex items-start gap-4">
                <div className="flex flex-col items-center">
                  <div className="w-3 h-3 rounded-full border-2 border-[#a3a6ff] bg-[#0e0e0e]" />
                  <div className="w-px h-10 border-l border-dashed border-[#494847] my-1" />
                  <div className="w-3 h-3 rounded-full bg-[#c180ff]" />
                </div>
                <div className="flex-1 space-y-4">
                  <div>
                    <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">
                      Pickup
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {job.pickup}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] text-[#adaaaa] uppercase font-bold leading-none">
                      Drop-off
                    </p>
                    <p className="text-sm font-semibold text-white">
                      {job.dropoff}
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="md:w-px bg-[#494847]/10" />

            <div className="md:w-48 flex flex-col justify-between gap-4">
              <div className="space-y-3">
                <div className="flex justify-between text-xs">
                  <span className="text-[#adaaaa]">Distance</span>
                  <span className="text-white font-bold">{job.distance}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#adaaaa]">Est. Time</span>
                  <span className="text-white font-bold">{job.time}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-[#adaaaa]">Weight</span>
                  <span className="text-white font-bold">{job.weight}</span>
                </div>
              </div>
              <div className="flex flex-col gap-2">
                <button
                  className="w-full py-2.5 bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm rounded-lg transition-all active:scale-95"
                  style={{ boxShadow: "0px 0px 15px rgba(163,166,255,0.2)" }}
                >
                  Accept Job
                </button>
                <button className="w-full py-2.5 bg-transparent border border-[#494847]/30 text-[#adaaaa] hover:text-[#ff6e84] hover:border-[#ff6e84]/30 text-sm font-bold rounded-lg transition-all active:scale-95">
                  Reject
                </button>
              </div>
            </div>
          </div>
        ))}

        {/* Stats Row */}
        <div className="lg:col-span-12 grid grid-cols-2 md:grid-cols-4 gap-4 mt-4">
          {[
            { label: "Jobs in Queue", value: "128", valueColor: "text-white" },
            {
              label: "Avg. Payout",
              value: "$54.20",
              valueColor: "text-[#a3a6ff]",
            },
            {
              label: "Fuel Surplus",
              value: "82%",
              valueColor: "text-[#c180ff]",
            },
            { label: "Driver Rating", value: "4.9", valueColor: "text-white", star: true },
          ].map((stat) => (
            <div
              key={stat.label}
              className="bg-[#1a1919] rounded-xl p-6 border border-[#494847]/5"
            >
              <p className="text-[10px] font-bold text-[#adaaaa] uppercase tracking-widest">
                {stat.label}
              </p>
              <div className="flex items-center mt-1 gap-1">
                <p className={`text-3xl font-black ${stat.valueColor}`}>
                  {stat.value}
                </p>
                {stat.star && (
                  <span
                    className="material-symbols-outlined text-[#a3a6ff] ml-1"
                    style={{ fontVariationSettings: "'FILL' 1" }}
                  >
                    star
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
