import Link from 'next/link'

export default function Header() {
  return (
    <nav className="fixed top-0 left-0 w-full h-16 z-40 bg-[#0e0e0e]/80 backdrop-blur-xl border-b border-[#494847]/15 flex items-center justify-between px-8 shadow-2xl shadow-black/20">
      <div className="flex items-center gap-4">
        <Link href="/" className="text-lg font-bold text-white font-headline">Kinetic Void</Link>
        <div className="hidden lg:flex items-center bg-[#262626] px-4 py-1.5 rounded-full border border-[#494847]/10 focus-within:ring-1 focus-within:ring-[#a3a6ff]/30">
          <span className="material-symbols-outlined text-[#adaaaa] text-sm mr-2" style={{ fontSize: '16px' }}>
            search
          </span>
          <input
            className="bg-transparent border-none outline-none text-sm text-white w-48 placeholder:text-[#adaaaa]"
            placeholder="Track shipment..."
            type="text"
          />
        </div>
      </div>

      <div className="flex items-center gap-6">
        <div className="hidden md:flex gap-6">
          <Link href="/how-it-works" className="text-[#adaaaa] hover:text-white font-inter text-sm cursor-pointer transition-colors duration-200">
            How It Works
          </Link>
          <Link href="/our-fleet" className="text-[#adaaaa] hover:text-white font-inter text-sm cursor-pointer transition-colors duration-200">
            Fleet
          </Link>
          <Link href="/safety" className="text-[#adaaaa] hover:text-white font-inter text-sm cursor-pointer transition-colors duration-200">
            Safety
          </Link>
          <Link href="/about" className="text-[#adaaaa] hover:text-white font-inter text-sm cursor-pointer transition-colors duration-200">
            About
          </Link>
          <Link href="/contact" className="text-[#adaaaa] hover:text-white font-inter text-sm cursor-pointer transition-colors duration-200">
            Contact
          </Link>
        </div>
        <div className="flex items-center gap-4 border-l border-[#494847]/20 pl-6">
          <span className="material-symbols-outlined text-[#adaaaa] hover:text-white cursor-pointer">
            notifications
          </span>
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[#a3a6ff]/20">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuD-3wp2FpizO9MFLbVCybq3ZzZTW7p-2DpMqbXc3O3TzoSvuzLuCrilhCCtv-wGci4H41WUeeFwkhHqLBWvVJGqZFg-LMoiTCaCVfokQfGJN7-Fx-qmc2vDnQQq8kOlUXP8mCRqu_TmyzOZXO3g5n4fVvMA68UaIV84xX3G7_5uZDHzNoAWhvIzNSeGojjJFzjl5UMAko8TatG9odqiijpCLxHsK_IHfFgDEgC5TgOcB0UvMOkvodrRKJMB0NUeqpMff8hjP_Jl3Q"
              alt="Administrator profile"
            />
          </div>
        </div>
      </div>
    </nav>
  )
}
