import BookingCard from './BookingCard'

export default function Hero() {
  return (
    <section className="relative min-h-[921px] flex items-center px-8 py-20 overflow-hidden">
      {/* Background image */}
      <div className="absolute inset-0 z-0">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          className="w-full h-full object-cover opacity-40"
          src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbp_tdB9_mx8K3LMYJ9Dan4fK8pyGM9VXngSN3R6JcoaV0e3kau9IZrx4WiAmziCaQxUOcL-MuOELG0pZNeUlCJlcGSLBI2bvwLGBfBsIZbRDBLFVFY-mi4ZUjPZmjkLIEhGIOVqhji7-VAVGqT4YvonSSyhdvUpfRkDjdpvvGRqoVlxIPCYc1SXscy0dR5hjEu4n9hV-TQx4iYvarL9wsp3oWc5QXGY9ThK2-9aKUyLXI6Ihrb2tIYvhuKa21szWEadhDRhZu8g"
          alt="Logistics vans moving through a neon-lit city at night"
        />
        <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e] via-[#0e0e0e]/80 to-transparent"></div>
      </div>

      <div className="relative z-10 max-w-7xl mx-auto grid lg:grid-cols-2 gap-16 items-center w-full">
        {/* Left: copy */}
        <div>
          <span className="inline-block px-4 py-1 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold tracking-widest uppercase mb-6">
            Ultra-Fast Deployment
          </span>
          <h1 className="text-5xl lg:text-7xl font-black font-headline text-white leading-tight tracking-tighter mb-8">
            The Future of{' '}
            <span className="text-[#a3a6ff] italic">Kinetic</span> Logistics.
          </h1>
          <p className="text-lg text-[#adaaaa] max-w-md leading-relaxed mb-10">
            Experience precision-engineered delivery solutions. From microscopic components to
            industrial fleets, we bridge the void with absolute speed.
          </p>
          <div className="flex flex-wrap gap-4">
            <button className="px-8 py-4 milled-gradient rounded-full text-[#0f00a4] font-bold shadow-lg glow-primary active:scale-95 transition-transform cursor-pointer">
              Initiate Transit
            </button>
            <button className="px-8 py-4 bg-[#262626] border border-[#494847]/30 rounded-full text-white font-semibold hover:bg-[#262626]/80 transition-colors cursor-pointer">
              View Fleet
            </button>
          </div>
        </div>

        {/* Right: booking card */}
        <BookingCard />
      </div>
    </section>
  )
}
