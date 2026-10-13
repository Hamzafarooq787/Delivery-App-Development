export default function Footer() {
  return (
    <footer className="px-8 py-20 border-t border-[#494847]/10">
      <div className="max-w-7xl mx-auto grid grid-cols-2 md:grid-cols-4 gap-12">
        <div className="col-span-2">
          <h2 className="text-2xl font-black font-headline tracking-tighter mb-6">Go Drop</h2>
          <p className="text-[#adaaaa] max-w-sm mb-8">
            Redefining the physical movement of assets through technology and precision.
          </p>
          <div className="flex gap-4">
            <div className="w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center hover:bg-[#a3a6ff] transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-sm" style={{ fontSize: '18px' }}>
                language
              </span>
            </div>
            <div className="w-10 h-10 rounded-full bg-[#262626] flex items-center justify-center hover:bg-[#a3a6ff] transition-colors cursor-pointer">
              <span className="material-symbols-outlined text-sm" style={{ fontSize: '18px' }}>
                alternate_email
              </span>
            </div>
          </div>
        </div>

        <div>
          <h6 className="font-bold mb-6">Network</h6>
          <ul className="space-y-4 text-sm text-[#adaaaa]">
            <li>
              <a className="hover:text-[#a3a6ff]" href="/our-fleet">
                Our Fleet
              </a>
            </li>
            <li>
              <a className="hover:text-[#a3a6ff]" href="/pricing">
                Pricing
              </a>
            </li>
            <li>
              <a className="hover:text-[#a3a6ff]" href="/how-it-works">
                How It Works
              </a>
            </li>
          </ul>
        </div>

        <div>
          <h6 className="font-bold mb-6">Support</h6>
          <ul className="space-y-4 text-sm text-[#adaaaa]">
            <li>
              <a className="hover:text-[#a3a6ff]" href="/contact">
                Contact Us
              </a>
            </li>
            <li>
              <a className="hover:text-[#a3a6ff]" href="/safety">
                Safety
              </a>
            </li>
            <li>
              <a className="hover:text-[#a3a6ff]" href="/prohibited-items">
                Prohibited Items
              </a>
            </li>
          </ul>
        </div>
      </div>

      <div className="max-w-7xl mx-auto pt-16 mt-16 border-t border-[#494847]/5 flex flex-col md:flex-row justify-between items-center gap-6">
        <p className="text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold">
          © 2024 Go Drop Logistics. All rights reserved.
        </p>
        <div className="flex gap-8 text-[10px] uppercase tracking-widest text-[#adaaaa] font-bold">
          <a href="/privacy-policy" className="hover:text-white transition-colors">Privacy Policy</a>
          <a href="/terms" className="hover:text-white transition-colors">Terms of Service</a>
        </div>
      </div>
    </footer>
  )
}
