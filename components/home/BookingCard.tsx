export default function BookingCard() {
  return (
    <div className="glass-card px-4 py-6 sm:p-8 rounded-[2rem] border border-[#494847]/15 shadow-2xl w-full overflow-hidden">
      <h3 className="text-xl font-bold font-headline mb-6 flex items-center">
        <span className="material-symbols-outlined text-[#a3a6ff] mr-2">bolt</span>
        Quick Book
      </h3>
      <div className="space-y-4 sm:space-y-6">
        {/* Pickup */}
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1 ml-4">
            Pickup Point
          </label>
          <div className="flex items-center bg-black/50 rounded-xl px-4 h-12 sm:h-14 border border-[#494847]/10 focus-within:border-[#a3a6ff]/50 transition-colors w-full">
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
        <div className="flex justify-center my-3 sm:my-4 relative z-20">
          <div className="w-10 h-10 bg-[#a3a6ff] rounded-full flex items-center justify-center text-[#0f00a4] shadow-lg active:rotate-180 transition-transform cursor-pointer shrink-0">
            <span className="material-symbols-outlined">swap_vert</span>
          </div>
        </div>

        {/* Drop-off */}
        <div>
          <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1 ml-4">
            Drop-off Point
          </label>
          <div className="flex items-center bg-black/50 rounded-xl px-4 h-12 sm:h-14 border border-[#494847]/10 focus-within:border-[#a3a6ff]/50 transition-colors w-full">
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

        {/* Service tier + CTA */}
        <div className="flex flex-col sm:flex-row gap-3 sm:gap-4 mt-6">
          <div className="bg-black/50 rounded-xl p-4 border border-[#494847]/10 w-full sm:flex-1 min-w-0">
            <label className="block text-[10px] text-[#adaaaa] uppercase tracking-widest font-bold mb-1">
              Service Tier
            </label>
            <select className="bg-transparent border-none outline-none text-sm text-white w-full p-0 cursor-pointer">
              <option className="bg-[#0e0e0e]">Quantum (Instant)</option>
              <option className="bg-[#0e0e0e]">Flash (2-Hour)</option>
              <option className="bg-[#0e0e0e]">Standard</option>
            </select>
          </div>
          <button className="milled-gradient rounded-xl font-bold text-[#0f00a4] shadow-md hover:brightness-110 transition-all cursor-pointer text-sm sm:text-base w-full sm:w-auto sm:flex-1 h-14 sm:h-auto">
            Get Quote
          </button>
        </div>
      </div>
    </div>
  )
}
