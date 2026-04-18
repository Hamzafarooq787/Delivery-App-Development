import type { Metadata } from "next"
import Link from "next/link"

export const metadata: Metadata = {
  title: "Our Fleet | Kinetic Void",
  description: "Precision-engineered autonomous fleet designed for zero-latency logistics. From hyper-local delivery to heavy continental freight.",
}

const vehicles = [
  {
    tier: "Hyper-Local",
    tierColor: "text-[#a3a6ff]",
    name: "Courier Cycle",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDeg-F43PjW60L8IMldj52Wi76YyxZKTe3yHdebyqvz4PElXb2TnH5f9jLblKI-d7sUonSUx25qQmLA0z6dsnSl7Jpabio-0gKaAK_FkJWZqripWpNyo6mm9bWreNIKB0loHkmnxIbylceWFFtpph6ST8ZkegnVlw_X9GnOGfmXB0XsWhk0k8jUOLM585QP2kUnsbwmrcNZ_qqZ-9od1O5j16twEcBwvnMb9vSjdKf9vvIOEJaV2ed-zV-4zELIN3sfpG0uIMKK8Q",
    imgAlt: "Electric courier bike",
    specs: [
      { label: "Capacity", value: "45 KG" },
      { label: "Top Speed", value: "65 KM/H" },
      { label: "Range", value: "120 KM" },
    ],
  },
  {
    tier: "Urban Freight",
    tierColor: "text-[#c180ff]",
    name: "Kinetic Van",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuDSpObFjpAY23sTHr6ITCd2ELb8VqIPbiZJ9y0GoOVBVy7zpt7rVIRHx972TEutEc5PB2fAIIfSSHaePBbvK15o6hxKXyni2N9JjoysFzckrwG0oqAc8S2cb5mX8j-xQJmafzXGxe3dwDdLTTmotdKTJaXHE9zRWXFJrSMiQ2xKecpaSKEYJpp6loXP-YJq8oGi45RUAjGlWNW_RQQB4pB83FQf5wks0IhNnurbLRYgm-JzTKVIfk22JSxaoivxaNZOxrmCeNtVNw",
    imgAlt: "Electric delivery van",
    specs: [
      { label: "Capacity", value: "1,200 KG" },
      { label: "Top Speed", value: "110 KM/H" },
      { label: "Range", value: "450 KM" },
    ],
  },
  {
    tier: "Continental",
    tierColor: "text-[#ffa5d9]",
    name: "Heavy Freight",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuCUFQVarfp3p7hwKnJUSOWbNWIFaSeFHnA_naX1lVQBnS5mLeL7JdBiUGbuoJ4OrZM70JwDNPVFUo72dTFVKoN6tKPdRdvmOiSdjzWrKTJcqa_n8Fy97GpguqUwyD3r4ihdoT5UP-RMztDaE72bSbo-6fKnKj8An6NOoA-RVOdXLSCfuIF-irWxJeDHcnPzbeQk6dhTjIowbHln25lMypzQ0OVOGZncC9PrydxMqQBXHU_SurVCCboAWS4-AaYZKBSRFY6y5NsTUg",
    imgAlt: "Electric semi truck",
    specs: [
      { label: "Capacity", value: "18,000 KG" },
      { label: "Top Speed", value: "95 KM/H" },
      { label: "Range", value: "1,100 KM" },
    ],
  },
  {
    tier: "Aerial",
    tierColor: "text-[#a3a6ff]",
    name: "Aero-Drone",
    img: "https://lh3.googleusercontent.com/aida-public/AB6AXuC1DyTGKq8KNxcpF-w8R9hpUsK2zmAX-zBzjDBcmaeb4sNC5d8n3bQwfAYo6GGlRMwZ6wbzMEolxA5bvoWozDKRgrbqmUqzl_8GHufaZG5WGL9DFCGmCBWBZJ9fFMafLid5k-_K6DaGP2aG2yllEfKg4Zcm4rX0XKZ627O93q9YqOPZvY706hC53k89O_nGzGc8xigcr4s2DCz5pw51ImYiMxLahKXVtW7EdmaM9TZTEjqTckAt9jaxolIB8WUNuIT87chJbs-WA",
    imgAlt: "Logistics drone",
    specs: [
      { label: "Capacity", value: "15 KG" },
      { label: "Top Speed", value: "140 KM/H" },
      { label: "Range", value: "80 KM" },
    ],
  },
]

const ecosystemFeatures = [
  {
    iconColor: "text-[#a3a6ff] bg-[#1a1919]",
    icon: "⚡",
    title: "Universal Charging",
    desc: "Proprietary wireless kinetic charging pads integrated at every hub for 100% uptime.",
  },
  {
    iconColor: "text-[#c180ff] bg-[#1a1919]",
    icon: "⚙️",
    title: "Modular Cargo Hubs",
    desc: "Quick-swap container systems allow for vehicle transitions in under 120 seconds.",
  },
  {
    iconColor: "text-[#ffa5d9] bg-[#1a1919]",
    icon: "🎯",
    title: "L5 Autonomy",
    desc: "Every vehicle equipped with multi-spectrum LiDAR and real-time neural navigation.",
  },
]

export default function OurFleetPage() {
  return (
    <div className="min-h-screen bg-[#0e0e0e] text-white">
      {/* Hero */}
      <section className="relative min-h-[480px] sm:h-[614px] flex items-center px-4 sm:px-8 md:px-12 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgrAaZmPLxloo7BBQpjLE1MtZ2pHLUPyZBIhQlYfbOtbCeVlydHlEKVVEHTxEzwrgJUmldgzPqg33D1NLp1SkEfTOyVeXBzsUZw3K4v51dzDuQRtVIIKgx4uBx4I4LC3KSdqkZgZRpu7LzE6tp9I1Mr_-dNP92OcYe2ukj5iMNyuhqwm2sHFUgt84DYQem7FBnFIHEmCfNcKlVFSB0kvOwcWbvvSn7PtxLM2w6mgV4wZX-BzyhPyltV1-_gvI3upvsa8oJlpykXQ"
            alt="Futuristic logistics hub at night"
            className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e] via-[#0e0e0e]/80 to-transparent" />
        </div>
        <div className="relative z-10 max-w-3xl pt-20">
          <h1 className="font-headline text-4xl sm:text-5xl md:text-6xl font-extrabold tracking-tighter mb-4 sm:mb-6 leading-tight text-balance">
            THE FUTURE OF <span className="text-[#a3a6ff]">KINETIC</span> MOTION
          </h1>
          <p className="text-[#adaaaa] text-base sm:text-xl max-w-xl font-light leading-relaxed mb-6 sm:mb-8">
            Precision-engineered autonomous fleet designed for zero-latency logistics. From hyper-local delivery to heavy continental freight.
          </p>
          <div className="flex gap-4">
            <Link
              href="/contact"
              className="bg-[#a3a6ff] text-[#0f00a4] font-bold px-8 py-4 rounded-lg shadow-[0_0_15px_rgba(163,166,255,0.2)] active:scale-95 transition-all flex items-center gap-2"
            >
              Book Fleet &rarr;
            </Link>
          </div>
        </div>
      </section>

      {/* Fleet Grid */}
      <section className="px-4 sm:px-8 md:px-12 py-16 sm:py-24 bg-[#131313]">
        <div className="mb-10 sm:mb-16 flex justify-between items-end max-w-screen-2xl mx-auto">
          <div>
            <h2 className="font-headline text-3xl font-bold tracking-tight mb-2">Vehicle Tiers</h2>
            <p className="text-[#adaaaa]">Optimized for every node of the supply chain.</p>
          </div>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6 max-w-screen-2xl mx-auto">
          {vehicles.map((v) => (
            <div
              key={v.name}
              className="bg-[#262626]/60 backdrop-blur-xl border border-[#494847]/15 rounded-xl p-6 flex flex-col group hover:bg-[#201f1f] transition-all duration-500"
            >
              <div className="h-48 rounded-lg overflow-hidden mb-6">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={v.img}
                  alt={v.imgAlt}
                  className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                />
              </div>
              <div className="flex-grow">
                <div className={`text-xs font-bold tracking-widest uppercase mb-2 ${v.tierColor}`}>{v.tier}</div>
                <h3 className="font-headline text-2xl font-bold mb-4">{v.name}</h3>
                <div className="space-y-3">
                  {v.specs.map((spec) => (
                    <div key={spec.label} className="flex justify-between items-center text-sm">
                      <span className="text-[#adaaaa]">{spec.label}</span>
                      <span className="font-medium">{spec.value}</span>
                    </div>
                  ))}
                </div>
              </div>
              <button className="mt-8 w-full py-3 rounded-lg border border-[#a3a6ff]/30 text-[#a3a6ff] font-bold hover:bg-[#a3a6ff] hover:text-[#0f00a4] transition-all">
                Select Tier
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* Ecosystem Intelligence */}
      <section className="py-16 sm:py-24 px-4 sm:px-8 md:px-12 bg-[#0e0e0e]">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 lg:gap-20 items-center max-w-screen-2xl mx-auto">
          <div>
            <h2 className="font-headline text-3xl sm:text-4xl font-bold mb-6 sm:mb-8 tracking-tight text-balance">Ecosystem Intelligence</h2>
            <div className="space-y-8">
              {ecosystemFeatures.map((f) => (
                <div key={f.title} className="flex gap-6">
                  <div className={`w-12 h-12 rounded-lg flex items-center justify-center text-xl flex-shrink-0 ${f.iconColor}`}>
                    {f.icon}
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">{f.title}</h4>
                    <p className="text-[#adaaaa] text-sm">{f.desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="relative">
            <div className="aspect-square rounded-2xl overflow-hidden bg-[#262626]/60 backdrop-blur-xl border border-[#494847]/15 p-4">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src="https://lh3.googleusercontent.com/aida-public/AB6AXuA94sg9bdZjiZcQcgGPu6BxAC41g33OnIdv7hBliqBOe87AlPk_PFk_inukpWTaYshpQg9SYDa2jJlLTfDzTEte1YEF89NRHDrnSGCLKCkJJHIM7mDPqaozugJbXliew3VPhPwrdelTblIdYOUx5rudoehBKbBUcYzCXWbnYUjCL8h9BKvhfHemYCdM-UO1llQvGaDn1uS7mUwWaTX27-7ZGqwtz4ejoSqyvoEPUM70dMMj7UWQhc76bfdxjTyKRa4_KkZPLTS68Q"
                alt="Vehicle interior tech display"
                className="w-full h-full object-cover rounded-xl opacity-60"
              />
            </div>
            <div className="absolute -bottom-10 -left-10 bg-[#262626]/60 backdrop-blur-xl border border-[#a3a6ff]/20 p-8 rounded-2xl">
              <div className="text-5xl font-black text-[#a3a6ff] mb-1">99.9%</div>
              <div className="text-xs uppercase tracking-widest text-[#adaaaa]">Autonomous Uptime</div>
            </div>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="py-20 sm:py-32 px-4 sm:px-8 md:px-12 text-center bg-[#131313] overflow-hidden relative">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-[#a3a6ff]/10 blur-[120px] rounded-full pointer-events-none" />
        <div className="relative z-10 max-w-2xl mx-auto">
          <h2 className="font-headline text-3xl sm:text-5xl font-extrabold mb-4 sm:mb-6 tracking-tighter text-balance">Ready to optimize your velocity?</h2>
          <p className="text-[#adaaaa] text-base sm:text-lg mb-8 sm:mb-10">Join the network of thousands of businesses scaling their logistics through the Kinetic Void ecosystem.</p>
          <div className="flex flex-col sm:flex-row justify-center gap-4">
            <Link href="/contact" className="bg-[#a3a6ff] text-[#0f00a4] font-bold px-10 py-4 rounded-lg active:scale-95 transition-all text-lg">
              Book Now
            </Link>
            <Link href="/contact" className="bg-[#262626] border border-[#494847]/30 text-white font-bold px-10 py-4 rounded-lg active:scale-95 transition-all text-lg">
              Contact Enterprise
            </Link>
          </div>
        </div>
      </section>
    </div>
  )
}
