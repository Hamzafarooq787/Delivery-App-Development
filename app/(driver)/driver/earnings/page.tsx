const transactions = [
  {
    id: "KV-98231",
    name: "Heavy Cargo Delivery",
    sub: "Long Haul",
    icon: "local_shipping",
    iconColor: "text-[#a3a6ff]",
    date: "Oct 24, 2023",
    time: "14:20 PM",
    amount: "$124.50",
  },
  {
    id: "KV-98215",
    name: "Express Courier Service",
    sub: "Urban Fast",
    icon: "electric_bolt",
    iconColor: "text-[#c180ff]",
    date: "Oct 24, 2023",
    time: "11:05 AM",
    amount: "$45.00",
  },
  {
    id: "KV-98198",
    name: "Medical Supplies Transit",
    sub: "Priority",
    icon: "medical_services",
    iconColor: "text-[#ffa5d9]",
    date: "Oct 23, 2023",
    time: "09:15 AM",
    amount: "$115.00",
  },
]

export default function EarningsPage() {
  return (
    <div className="pt-2 pb-12 px-2">
      {/* Header & Tabs */}
      <div className="flex flex-col md:flex-row md:items-end justify-between gap-6 mb-10">
        <div>
          <h2 className="text-2xl md:text-4xl font-extrabold font-headline tracking-tighter text-white">
            Earnings
          </h2>
          <p className="text-[#adaaaa] mt-1">
            Real-time financial performance and payouts.
          </p>
        </div>
        <div className="flex bg-[#1a1919] p-1 rounded-xl">
          <button className="px-6 py-2 text-xs font-bold rounded-lg transition-all bg-[#201f1f] text-white">
            Daily
          </button>
          <button className="px-6 py-2 text-xs font-semibold rounded-lg transition-all text-[#adaaaa] hover:text-white">
            Weekly
          </button>
          <button className="px-6 py-2 text-xs font-semibold rounded-lg transition-all text-[#adaaaa] hover:text-white">
            Monthly
          </button>
        </div>
      </div>

      {/* Summary Bento Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-10">
        {/* Today Card */}
        <div
          className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-2xl relative overflow-hidden group border border-[#494847]/10 shadow-lg"
        >
          <div className="absolute -right-4 -top-4 w-24 h-24 bg-[#a3a6ff]/10 rounded-full blur-3xl group-hover:bg-[#a3a6ff]/20 transition-all" />
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#a3a6ff]">
              Today
            </span>
            <span className="material-symbols-outlined text-[#a3a6ff]">
              today
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black font-headline text-white">
              $284.50
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-[#c180ff] flex items-center">
              <span className="material-symbols-outlined text-xs mr-1">
                trending_up
              </span>
              +12.5%
            </span>
            <span className="text-[10px] text-[#adaaaa]">vs yesterday</span>
          </div>
        </div>

        {/* This Week Card */}
        <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
              This Week
            </span>
            <span className="material-symbols-outlined text-[#adaaaa]">
              calendar_view_week
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black font-headline text-white">
              $1,420.00
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-[#ff6e84] flex items-center">
              <span className="material-symbols-outlined text-xs mr-1">
                trending_down
              </span>
              -3.2%
            </span>
            <span className="text-[10px] text-[#adaaaa]">vs last week</span>
          </div>
        </div>

        {/* This Month Card */}
        <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5 shadow-md">
          <div className="flex items-center justify-between mb-4">
            <span className="text-xs font-bold uppercase tracking-widest text-[#adaaaa]">
              This Month
            </span>
            <span className="material-symbols-outlined text-[#adaaaa]">
              calendar_month
            </span>
          </div>
          <div className="flex items-baseline gap-1">
            <span className="text-4xl font-black font-headline text-white">
              $5,892.15
            </span>
          </div>
          <div className="mt-4 flex items-center gap-2">
            <span className="text-xs font-medium text-[#c180ff] flex items-center">
              <span className="material-symbols-outlined text-xs mr-1">
                trending_up
              </span>
              +8.1%
            </span>
            <span className="text-[10px] text-[#adaaaa]">vs last month</span>
          </div>
        </div>
      </div>

      {/* Asymmetric Layout */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
        {/* Transactions List (8 cols) */}
        <div className="lg:col-span-8 flex flex-col">
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-lg font-bold font-headline text-white">
              Recent Transactions
            </h3>
            <button className="text-[#a3a6ff] text-xs font-bold hover:underline">
              Download CSV
            </button>
          </div>
        <div className="bg-[#1a1919] rounded-2xl overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
          <div className="min-w-[520px]">
          <div className="grid grid-cols-12 gap-4 px-6 py-4 border-b border-[#494847]/10 text-[10px] uppercase tracking-widest font-bold text-[#adaaaa]">
            <div className="col-span-5">Job Details</div>
            <div className="col-span-3">Status</div>
            <div className="col-span-2">Date/Time</div>
            <div className="col-span-2 text-right">Amount</div>
            </div>
            <div className="divide-y divide-[#494847]/5">
              {transactions.map((tx) => (
                <div
                  key={tx.id}
                  className="grid grid-cols-12 gap-4 px-6 py-5 items-center hover:bg-[#201f1f] transition-colors cursor-pointer"
                >
                  <div className="col-span-5 flex items-center gap-4">
                    <div className="w-10 h-10 rounded-lg bg-[#262626] flex items-center justify-center">
                      <span
                        className={`material-symbols-outlined ${tx.iconColor}`}
                      >
                        {tx.icon}
                      </span>
                    </div>
                    <div>
                      <p className="text-sm font-bold text-white">{tx.name}</p>
                      <p className="text-xs text-[#adaaaa]">
                        ID: {tx.id} • {tx.sub}
                      </p>
                    </div>
                  </div>
                  <div className="col-span-3">
                    <span className="px-2 py-1 bg-[#a3a6ff]/10 text-[#a3a6ff] text-[10px] font-bold rounded uppercase">
                      Completed
                    </span>
                  </div>
                  <div className="col-span-2">
                    <p className="text-xs text-white font-medium">{tx.date}</p>
                    <p className="text-[10px] text-[#adaaaa]">{tx.time}</p>
                  </div>
                  <div className="col-span-2 text-right">
                    <p className="text-sm font-black text-white">{tx.amount}</p>
                  </div>
                </div>
              ))}
            </div>
            <button className="w-full py-4 text-xs font-bold text-[#adaaaa] hover:text-white hover:bg-[#201f1f] transition-all">
              View All 156 Transactions
            </button>
          </div>
        </div>

        {/* Financial Insights (4 cols) */}
        <div className="lg:col-span-4 space-y-6">
          <h3 className="text-lg font-bold font-headline text-white">
            Insights
          </h3>

          {/* Earnings Velocity */}
          <div className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5">
            <p className="text-[10px] uppercase font-bold tracking-widest text-[#adaaaa] mb-4">
              Earnings Velocity
            </p>
            <div className="h-32 flex items-end justify-between gap-1 mb-4">
              {[40, 60, 50, 90, 70, 100, 30].map((h, i) => (
                <div
                  key={i}
                  className={`w-full rounded-t ${i === 5 ? "bg-[#a3a6ff]" : "bg-[#a3a6ff]/20"}`}
                  style={{
                    height: `${h}%`,
                    boxShadow:
                      i === 5
                        ? "0px 0px 10px rgba(163,166,255,0.4)"
                        : undefined,
                  }}
                />
              ))}
            </div>
            <p className="text-xs text-[#adaaaa] text-center">
              Earnings are 12% higher than your daily average this week.
            </p>
          </div>

          {/* Next Payout */}
          <div
            className="bg-[rgba(38,38,38,0.6)] backdrop-blur-xl p-6 rounded-2xl border border-[#a3a6ff]/20"
          >
            <div className="flex items-center gap-3 mb-6">
              <div
                className="w-10 h-10 rounded-full bg-[#a3a6ff] flex items-center justify-center text-[#0f00a4]"
                style={{
                  boxShadow: "0px 0px 15px rgba(163,166,255,0.3)",
                }}
              >
                <span className="material-symbols-outlined">
                  account_balance_wallet
                </span>
              </div>
              <div>
                <p className="text-sm font-bold text-white">Next Payout</p>
                <p className="text-[10px] text-[#adaaaa] font-medium">
                  Auto-deposit enabled
                </p>
              </div>
            </div>
            <p className="text-3xl font-black font-headline text-white mb-2">
              $842.10
            </p>
            <p className="text-xs text-[#adaaaa] mb-6">
              Scheduled for Monday, Oct 27
            </p>
            <button
              className="w-full py-3 bg-[#a3a6ff] text-[#0f00a4] text-xs font-bold rounded-xl active:scale-95 transition-transform"
            >
              Withdraw Now
            </button>
          </div>

          {/* Active Bonus */}
          <div className="bg-[#201f1f] p-6 rounded-2xl relative overflow-hidden">
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background:
                  "linear-gradient(to bottom right, rgba(193,128,255,0.1), transparent)",
              }}
            />
            <div className="relative z-10">
              <span className="inline-block px-2 py-0.5 bg-[#c180ff] text-[#33005b] text-[8px] font-black uppercase rounded-full mb-3">
                Active Bonus
              </span>
              <h4 className="text-sm font-bold text-white mb-1">
                Weekend Surge x1.5
              </h4>
              <p className="text-xs text-[#adaaaa]">
                Complete 5 more jobs before Sunday to unlock the multiplier.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
