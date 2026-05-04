export default function AdminSettingsPage() {
  return (
    <div className="px-4 md:px-8 py-6 md:py-8 min-h-screen bg-[#131313]">
      {/* Header */}
      <div className="mb-6 md:mb-8">
        <h1 className="text-3xl md:text-4xl font-headline font-black tracking-tight text-white">Platform Config</h1>
        <p className="text-[#adaaaa] mt-2 text-sm">
          Global controls — pricing, operations, integrations, and notifications.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-12 gap-6 max-w-5xl">
        {/* Left Nav */}
        <div className="col-span-1 md:col-span-3">
          <nav className="flex md:flex-col flex-wrap gap-1">
            {[
              { label: "General", icon: "tune", active: true },
              { label: "Pricing & Fees", icon: "payments", active: false },
              { label: "Notifications", icon: "notifications", active: false },
              { label: "Integrations", icon: "extension", active: false },
              { label: "Security", icon: "lock", active: false },
            ].map((item) => (
              <button
                key={item.label}
                className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-sm font-semibold transition-all ${
                  item.active
                    ? "bg-[#a3a6ff]/10 text-[#a3a6ff]"
                    : "text-[#adaaaa] hover:text-white hover:bg-[#1a1919]"
                }`}
              >
                <span
                  className={`material-symbols-outlined text-base ${item.active ? "text-[#a3a6ff]" : ""}`}
                >
                  {item.icon}
                </span>
                {item.label}
              </button>
            ))}
          </nav>
        </div>

        {/* Settings Panels */}
        <div className="col-span-1 md:col-span-9 space-y-6">
          {/* General */}
          <div className="bg-[#1a1919] rounded-xl p-5 md:p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#a3a6ff]">tune</span>
              <h3 className="text-base font-bold text-white font-headline">General Settings</h3>
            </div>
            <div className="space-y-4">
              {[
                { label: "Platform Name", placeholder: "Kinetic Velocity", type: "text" },
                { label: "Support Email", placeholder: "support@kinetic.io", type: "email" },
                { label: "Support Phone", placeholder: "+1 (800) 000-0000", type: "tel" },
              ].map(({ label, placeholder, type }) => (
                <div key={label}>
                  <label className="block text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">
                    {label}
                  </label>
                  <input
                    type={type}
                    placeholder={placeholder}
                    className="w-full bg-[#201f1f] border border-[#494847]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#494847] outline-none focus:border-[#a3a6ff]/40 transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="bg-[#a3a6ff] text-[#0f00a4] font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[#b5b8ff] transition-colors">
                Save General
              </button>
            </div>
          </div>

          {/* Pricing */}
          <div className="bg-[#1a1919] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#c180ff]">payments</span>
              <h3 className="text-base font-bold text-white font-headline">Pricing &amp; Fees</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {[
                { label: "Base Fare ($)", placeholder: "5.00" },
                { label: "Per Mile Rate ($)", placeholder: "1.20" },
                { label: "Platform Commission (%)", placeholder: "15" },
                { label: "Driver Payout Share (%)", placeholder: "80" },
              ].map(({ label, placeholder }) => (
                <div key={label}>
                  <label className="block text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold mb-2">
                    {label}
                  </label>
                  <input
                    type="number"
                    placeholder={placeholder}
                    className="w-full bg-[#201f1f] border border-[#494847]/10 rounded-xl px-4 py-3 text-white text-sm placeholder-[#494847] outline-none focus:border-[#c180ff]/40 transition-colors"
                  />
                </div>
              ))}
            </div>
            <div className="mt-6 flex justify-end">
              <button className="bg-[#c180ff]/15 text-[#c180ff] border border-[#c180ff]/20 font-bold text-sm px-6 py-2.5 rounded-xl hover:bg-[#c180ff]/25 transition-colors">
                Save Pricing
              </button>
            </div>
          </div>

          {/* Notifications */}
          <div className="bg-[#1a1919] rounded-xl p-6">
            <div className="flex items-center gap-2 mb-6">
              <span className="material-symbols-outlined text-[#ffa5d9]">notifications</span>
              <h3 className="text-base font-bold text-white font-headline">Notification Templates</h3>
            </div>
            <div className="space-y-2">
              {[
                "Order Confirmed",
                "Driver Assigned",
                "Out for Delivery",
                "Order Delivered",
                "Order Cancelled",
              ].map((template, i) => (
                <div
                  key={template}
                  className="group flex items-center justify-between px-4 py-4 rounded-xl hover:bg-[#201f1f] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-8 rounded-lg bg-[#ffa5d9]/10 flex items-center justify-center">
                      <span className="material-symbols-outlined text-[#ffa5d9] text-sm">mail</span>
                    </div>
                    <div>
                      <p className="text-white text-sm font-semibold">{template}</p>
                      <p className="text-[#adaaaa] text-[10px]">SMS + Push + Email</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3">
                    <div className="w-8 h-4 rounded-full bg-[#a3a6ff]/80 relative cursor-pointer">
                      <div className="absolute right-0.5 top-0.5 w-3 h-3 rounded-full bg-white" />
                    </div>
                    <button className="opacity-0 group-hover:opacity-100 text-[10px] font-bold text-[#adaaaa] hover:text-white transition-all">
                      Edit
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
