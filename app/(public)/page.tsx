import type { Metadata } from "next"
import Link from "next/link"
import BookingCard from "@/components/home/BookingCard"

export const metadata: Metadata = {
  title: "Go Drop | Premium Logistics",
  description: "Experience precision-engineered delivery solutions. From microscopic components to industrial fleets, we bridge the void with absolute speed.",
}

export default function HomePage() {
  return (
    <>
      {/* Hero Section */}
      <section className="relative min-h-[100svh] lg:min-h-[921px] flex items-center px-4 sm:px-8 py-24 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover opacity-40"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbp_tdB9_mx8K3LMYJ9Dan4fK8pyGM9VXngSN3R6JcoaV0e3kau9IZrx4WiAmziCaQxUOcL-MuOELG0pZNeUlCJlcGSLBI2bvwLGBfBsIZbRDBLFVFY-mi4ZUjPZmjkLIEhGIOVqhji7-VAVGqT4YvonSSyhdvUpfRkDjdpvvGRqoVlxIPCYc1SXscy0dR5hjEu4n9hV-TQx4iYvarL9wsp3oWc5QXGY9ThK2-9aKUyLXI6Ihrb2tIYvhuKa21szWEadhDRhZu8g"
            alt="Kinetic logistics fleet"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e] via-[#0e0e0e]/80 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center w-full">
          <div>
            <span className="inline-block px-4 py-1 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold tracking-widest uppercase mb-6">
              Ultra-Fast Deployment
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black font-headline text-white leading-tight tracking-tighter mb-6 lg:mb-8 text-balance">
              The Future of <span className="text-[#a3a6ff] italic">Kinetic</span> Logistics.
            </h1>
            <p className="text-base sm:text-lg text-[#adaaaa] max-w-md leading-relaxed mb-8 lg:mb-10">
              Experience precision-engineered delivery solutions. From microscopic components to industrial fleets, we bridge the void with absolute speed.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link href="/signup" className="w-full sm:w-auto text-center px-8 py-4 milled-gradient rounded-full text-[#0f00a4] font-bold shadow-lg glow-primary active:scale-95 transition-transform">
                Initiate Transit
              </Link>
              <Link href="/our-fleet" className="w-full sm:w-auto text-center px-8 py-4 bg-[#262626] border border-[#494847]/30 rounded-full text-white font-semibold hover:bg-[#262626]/80 transition-colors">
                View Fleet
              </Link>
            </div>
          </div>

          {/* Quick Book Widget */}
          <BookingCard />
        </div>
      </section>

      {/* How it Works: Bento Grid */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight mb-4">Operational Protocol</h2>
            <p className="text-[#adaaaa]">Three phases to total logistical dominance.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            {[
              { icon: "👆", color: "[#a3a6ff]", bg: "[#a3a6ff]/10", borderHover: "primary", title: "Digital Request", desc: "System-wide synchronization begins the moment you confirm your order. Our AI optimizes routes in real-time." },
              { icon: "📦", color: "[#c180ff]", bg: "[#c180ff]/10", borderHover: "secondary", title: "Secure Induction", desc: "Our kinetic agents arrive within 15 minutes for pickup, utilizing biometric verification for all transfers." },
              { icon: "🚀", color: "[#a3a6ff]", bg: "[#a3a6ff]/10", borderHover: "primary", title: "Final Delivery", desc: "Real-time GPS tracking and instant proof-of-delivery ensure your assets reach the destination flawlessly." },
            ].map((item) => (
              <div key={item.title} className="bg-[#1a1919] p-7 sm:p-10 rounded-[2rem] border border-[#494847]/5 hover:border-[#a3a6ff]/20 transition-all group">
                <div className={`w-14 h-14 bg-${item.bg} rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform text-2xl`}>
                  {item.icon}
                </div>
                <h4 className="text-xl font-bold mb-4">{item.title}</h4>
                <p className="text-[#adaaaa] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#a3a6ff]/5 blur-[120px] rounded-full -translate-y-1/2 pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div className="relative aspect-square rounded-[3rem] overflow-hidden">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCreGwQQ9snl-rqtptjDHd7Rl9amQgi1iyhP3iFJdCJfFUfdzLNdh7IWvvDJVV-BR40a7V-c_xUHjJN-lr7UOqzjJgOv0pmT4z0nCwc1DsNaBmUmeRIO3lHJtfXrq6AEh9S3Qt8aZU2D_l5MuFyTwJ8U8HBWSq3My5oAgF47rdw-Mb7nm8yY8qeUfTW_V4OtIuVKbjCTX6xovkutblwpmw6JNWczrBn8UL-CGFgLV0UpfYjUyJJjgO4Dj9EUh_SiA2G6yxDTPGNPA"
              alt="Encrypted custody"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent" />
            <div className="absolute bottom-4 sm:bottom-10 left-4 sm:left-10 right-4 sm:right-10 glass-card p-4 sm:p-6 rounded-2xl border border-[#494847]/20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#c180ff] rounded-full text-[#33005b]">🔒</div>
                <div>
                  <h5 className="font-bold">Encrypted Custody</h5>
                  <p className="text-xs text-[#adaaaa]">Full liability insurance up to $500k</p>
                </div>
              </div>
            </div>
          </div>
          <div>
            <h2 className="text-3xl sm:text-4xl font-black font-headline tracking-tight mb-6 sm:mb-8 text-balance">Fortress-Grade Security</h2>
            <ul className="space-y-8">
              {[
                { icon: "🔐", title: "End-to-End Encryption", desc: "Every shipment is tracked via an encrypted ledger, ensuring data integrity from origin to destination." },
                { icon: "👆", title: "Identity Verification", desc: "Couriers undergo multi-factor biometric authentication at every transition point in the journey." },
                { icon: "🌡️", title: "Climate Control", desc: "Our premium fleet features active environmental monitoring for sensitive pharmaceutical and tech cargo." },
              ].map((item) => (
                <li key={item.title} className="flex gap-6">
                  <span className="text-[#a3a6ff] text-xl mt-1">{item.icon}</span>
                  <div>
                    <h6 className="font-bold mb-1">{item.title}</h6>
                    <p className="text-sm text-[#adaaaa]">{item.desc}</p>
                  </div>
                </li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* Global Fleet Section */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
        <div className="max-w-7xl mx-auto">
          <div className="text-center mb-10 sm:mb-16">
            <h2 className="text-3xl sm:text-4xl font-black font-headline tracking-tight mb-4 text-balance">The Kinetic Global Fleet</h2>
            <p className="text-[#adaaaa]">Strategically positioned to respond in milliseconds.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {[
              { label: "Ground Unit", tier: "[#a3a6ff]", name: "Stealth Runner", desc: "Agile city-navigation", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCVVk9QV_vBG7xfICXQ259DaN2Jj3AMol0grVXQQHgi5pAPENx9mn_825laj0AIFjaqyvn4YjaPPsUtgvpRwdK_Jmt4CO2SqwrBRLR_k8Xxlb_Z-B4hrkGfPPlXDzDJypTkGejsk17q7i-E80a2-rfqnupRzYXDNgrtvCFLiZi59aRKXBqzGP13OrbHTRk2pxH0ih0qJ_SA-7Ot7SwrwMA3xbTVQ23pDACQ0uLgiXfLhKxy1mQTlg4sIOPuxzDcksDuiWZ_zzGyKQ", offset: "" },
              { label: "Heavy Transit", tier: "[#c180ff]", name: "Titan Carrier", desc: "Bulk industrial logistics", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCPkpY080fdCq9JZSqOGDwk3yi93pyRBFRSVNYCzpO5hRSkemTrJWcv_ynmwrddvUFI45FarTyOxb393sXJLtgIj0i9WKA49EnkeGQ2X_q04r-NNm-3fopxQ6U04jnjuUwNZC659bYSnYMIVNXHFAknMw-J6_5mFGHpaRltUQnndkEoU84778mm6UuTpHp6gTQ23FjhcszOtI78DENFYA7oPGYsu4xHW5pZXg3IeeLhsKBP7ChNu6PzK0qWfavHhO89-y2-HY0EuQ", offset: "lg:mt-12" },
              { label: "Airborne", tier: "[#a3a6ff]", name: "Aero-Drone V2", desc: "Instant short-range drop", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCeN46UzNkG4RJ6i1sQOW8eogNnhnraBQnHjQKjLwt6PIPFklTZ4XEvh14HT73GZpyQQZXh6hn9A6zQ2IfxdgQAXWHoozkurktVaa6vBk_lwWmVgqXOeBq10EO0msUudNdDVcXQmGnpghHvmDJxLqNRMLgy3Fnf1L1B1k9z7ORjE20rofHj1PKX6dBALAYNoDbZz3TS3r2v3t8p-RKo9GOunEaUNBXe1z2nDsI5hsyuvBOgqBuxYl41f4pA7Zssf49jvGe19DDK0Q", offset: "" },
              { label: "Hyper-Local", tier: "[#c180ff]", name: "Velocity Bike", desc: "Zero-emission precision", img: "https://lh3.googleusercontent.com/aida-public/AB6AXuAEK71nwZrjCR5ABm0FlIlqYYQ0vKUuUoBmCk7ZfJWuFxjD6lnBELw_fB59msqxTVBJZkHroJEMN4NPwR-u2maKUi8CWkHfHO3FC8yVwRs5Y-d2YjVmvoPSbmuSbjw5HpfzrqlfFBY_r9DZCkBzATDEOeO666Y3yeqzIst5Qd06Gp86EPWkwxTR2BYN8WBJu5LEXEslIIuPwjtIDVEj9DEPzCG7BE_fSJtR1RoR7K7Ujr7wZf7Mo21og1OqWUGVNMbF9tusXK8gDA", offset: "lg:mt-12" },
            ].map((card) => (
              <div key={card.name} className={`group relative h-[320px] sm:h-[400px] rounded-[2rem] overflow-hidden ${card.offset}`}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110" src={card.img} alt={card.name} />
                <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
                <div className="absolute bottom-0 left-0 p-8">
                  <span className={`text-[10px] uppercase font-bold tracking-widest text-${card.tier} mb-2 block`}>{card.label}</span>
                  <h5 className="text-xl font-bold">{card.name}</h5>
                  <p className="text-xs text-gray-400 mt-2">{card.desc}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

    </>
  )
}
