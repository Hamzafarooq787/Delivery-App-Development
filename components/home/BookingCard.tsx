export default function BookingCard() {
  return (
    <div className="glass-card w-full max-w-md mx-auto p-4 sm:p-6 lg:p-8 rounded-[2rem] border border-[#494847]/15 shadow-2xl overflow-hidden">
      <h3 className="text-xl font-bold font-headline mb-6 flex items-center">
        <span className="material-symbols-outlined text-[#a3a6ff] mr-2">bolt</span>
        Quick Book
      </h3>

      <div className="flex flex-col gap-4">

        {/* Pickup */}
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1 ml-4">
            Pickup Point
          </label>
          <div className="flex items-center bg-black/50 rounded-xl px-4 h-12 w-full border border-[#494847]/10 focus-within:border-[#a3a6ff]/50 transition-colors">
            <span className="material-symbols-outlined text-[#a3a6ff] mr-3 shrink-0" style={{ fontSize: '18px' }}>
              location_on
            </span>
            <input
              className="bg-transparent border-none outline-none text-sm text-white w-full min-w-0 placeholder:text-[#adaaaa]"
              placeholder="Enter origin address"
              type="text"
            />
          </div>
        </div>

        {/* Swap button */}
        <div className="flex justify-center relative z-20">
          <div className="w-10 h-10 bg-[#a3a6ff] rounded-full flex items-center justify-center text-[#0f00a4] shadow-lg active:rotate-180 transition-transform cursor-pointer shrink-0">
            <span className="material-symbols-outlined">swap_vert</span>
          </div>
        </div>

        {/* Drop-off */}
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1 ml-4">
            Drop-off Point
          </label>
          <div className="flex items-center bg-black/50 rounded-xl px-4 h-12 w-full border border-[#494847]/10 focus-within:border-[#c180ff]/50 transition-colors">
            <span className="material-symbols-outlined text-[#c180ff] mr-3 shrink-0" style={{ fontSize: '18px' }}>
              flag
            </span>
            <input
              className="bg-transparent border-none outline-none text-sm text-white w-full min-w-0 placeholder:text-[#adaaaa]"
              placeholder="Enter destination"
              type="text"
            />
          </div>
        </div>

        {/* Service tier + CTA — stack on mobile, row on lg */}
        <div className="flex flex-col lg:flex-row gap-3">
          <div className="bg-black/50 rounded-xl p-4 border border-[#494847]/10 w-full min-w-0 lg:flex-1">
            <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1">
              Service Tier
            </label>
            <select className="bg-transparent border-none outline-none text-sm text-white w-full p-0 cursor-pointer">
              <option className="bg-[#0e0e0e]">Quantum (Instant)</option>
              <option className="bg-[#0e0e0e]">Flash (2-Hour)</option>
              <option className="bg-[#0e0e0e]">Standard</option>
            </select>
          </div>
          <button className="milled-gradient rounded-xl font-bold text-[#0f00a4] shadow-md hover:brightness-110 transition-all cursor-pointer text-sm w-full h-12 lg:flex-1 lg:h-auto">
            Get Quote
          </button>
        </div>

      </div>
    </div>
  )
}
