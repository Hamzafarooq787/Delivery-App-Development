import type { Metadata } from 'next'
import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'

export const metadata: Metadata = {
  title: 'Our Fleet | Kinetic Void',
  description:
    'Explore the Kinetic Void fleet — precision-engineered autonomous vehicles from hyper-local courier cycles to continental heavy freight and aerial drones.',
}

const fleetVehicles = [
  {
    tier: 'Hyper-Local',
    tierColor: 'text-primary',
    name: 'Courier Cycle',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDeg-F43PjW60L8IMldj52Wi76YyxZKTe3yHdebyqvz4PElXb2TnH5f9jLblKI-d7sUonSUx25qQmLA0z6dsnSl7Jpabio-0gKaAK_FkJWZqripWpNyo6mm9bWreNIKB0loHkmnxIbylceWFFtpph6ST8ZkegnVlw_X9GnOGfmXB0XsWhk0k8jUOLM585QP2kUnsbwmrcNZ_qqZ-9od1O5j16twEcBwvnMb9vSjdKf9vvIOEJaV2ed-zV-4zELIN3sfpG0uIMKK8Q',
    alt: 'Sleek black high-tech electric courier motorcycle',
    capacity: '45 KG',
    speed: '65 KM/H',
    range: '120 KM',
  },
  {
    tier: 'Urban Freight',
    tierColor: 'text-secondary',
    name: 'Kinetic Van',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuDSpObFjpAY23sTHr6ITCd2ELb8VqIPbiZJ9y0GoOVBVy7zpt7rVIRHx972TEutEc5PB2fAIIfSSHaePBbvK15o6hxKXyni2N9JjoysFzckrwG0oqAc8S2cb5mX8j-xQJmafzXGxe3dwDdLTTmotdKTJaXHE9zRWXFJrSMiQ2xKecpaSKEYJpp6loXP-YJq8oGi45RUAjGlWNW_RQQB4pB83FQf5wks0IhNnurbLRYgm-JzTKVIfk22JSxaoivxaNZOxrmCeNtVNw',
    alt: 'Futuristic minimalist electric delivery van',
    capacity: '1,200 KG',
    speed: '110 KM/H',
    range: '450 KM',
  },
  {
    tier: 'Continental',
    tierColor: 'text-tertiary',
    name: 'Heavy Freight',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCUFQVarfp3p7hwKnJUSOWbNWIFaSeFHnA_naX1lVQBnS5mLeL7JdBiUGbuoJ4OrZM70JwDNPVFUo72dTFVKoN6tKPdRdvmOiSdjzWrKTJcqa_n8Fy97GpguqUwyD3r4ihdoT5UP-RMztDaE72bSbo-6fKnKj8An6NOoA-RVOdXLSCfuIF-irWxJeDHcnPzbeQk6dhTjIowbHln25lMypzQ0OVOGZncC9PrydxMqQBXHU_SurVCCboAWS4-AaYZKBSRFY6y5NsTUg',
    alt: 'Massive autonomous electric semi-truck',
    capacity: '18,000 KG',
    speed: '95 KM/H',
    range: '1,100 KM',
  },
  {
    tier: 'Aerial',
    tierColor: 'text-primary',
    name: 'Aero-Drone',
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuC1DyTGKq8KNxcpF-w8R9hpUsK2zmAX-zBzjDBcmaeb4sNC5d8n3bQwfADYo6GGlRMwZ6wbzMEolxA5bvoWozDKRgrbqmUqzl_8GHufaZG5WGL9DFCGmCBWBZJ9fFMafLid5k-_K6DaGP2aG2yllEfKg4Zcm4rX0XKZ627O93q9YqOPZvY706hC53k89O_nGzGc8xigcr4s2DCz5pw51ImYiMxLahKXVtW7EdmaM9TZTEjqTckAt9jaxolIB8WUNuIT87chJbs-WA',
    alt: 'Industrial cargo drone with eight rotors',
    capacity: '15 KG',
    speed: '140 KM/H',
    range: '80 KM',
  },
]

export default function OurFleetPage() {
  return (
    <div className="bg-surface font-inter text-on-surface antialiased">
      <Header />

      <main className="pt-20">
        {/* Hero Section */}
        <section className="relative h-[614px] flex items-center px-12 overflow-hidden bg-surface">
          <div className="absolute inset-0 z-0">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover opacity-30 mix-blend-luminosity"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuBgrAaZmPLxloo7BBQpjLE1MtZ2pHLUPyZBIhQlYfbOtbCeVlydHlEKVVEHTxEzwrgJUmldgzPqg33D1NLp1SkEfTOyVeXBzsUZw3K4v51dzDuQRtVIIKgx4uBx4I4LC3KSdqkZgZRpu7LzE6tp9I1Mr_-dNP92OcYe2ukj5iMNyuhqwm2sHFUgt84DYQem7FBnFIHEmCfNcKlVFSB0kvOwcWbvvSn7PtxLM2w6mgV4wZX-BzyhPyltV1-_gvI3upvsa8oJlpykXQ"
              alt="Cinematic logistics background"
            />
            <div className="absolute inset-0 bg-gradient-to-r from-surface via-surface/80 to-transparent"></div>
          </div>
          <div className="relative z-10 max-w-3xl">
            <h1 className="font-headline text-6xl font-extrabold tracking-tighter mb-6 leading-tight">
              THE FUTURE OF <span className="text-primary">KINETIC</span> MOTION
            </h1>
            <p className="text-on-surface-variant text-xl max-w-xl font-light leading-relaxed mb-8">
              Precision-engineered autonomous fleet designed for zero-latency logistics. From hyper-local delivery to heavy continental freight.
            </p>
            <div className="flex gap-4">
              <button className="bg-primary text-on-primary font-bold px-8 py-4 rounded-lg shadow-[0_0_15px_rgba(163,166,255,0.2)] active:scale-95 transition-all flex items-center gap-2">
                <span>Book Fleet</span>
                <span className="material-symbols-outlined">arrow_forward</span>
              </button>
            </div>
          </div>
        </section>

        {/* Fleet Grid */}
        <section className="px-12 py-24 bg-surface-container-low">
          <div className="mb-16 flex justify-between items-end">
            <div>
              <h2 className="font-headline text-3xl font-bold tracking-tight mb-2">Vehicle Tiers</h2>
              <p className="text-on-surface-variant">Optimized for every node of the supply chain.</p>
            </div>
            <div className="flex gap-2">
              <button className="p-2 rounded-full border border-[#494847] hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">west</span>
              </button>
              <button className="p-2 rounded-full border border-[#494847] hover:bg-surface-container-high transition-colors">
                <span className="material-symbols-outlined">east</span>
              </button>
            </div>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {fleetVehicles.map((vehicle) => (
              <div
                key={vehicle.name}
                className="glass-card rounded-xl p-6 flex flex-col group hover:bg-surface-container-high transition-all duration-500"
              >
                <div className="h-48 rounded-lg overflow-hidden mb-6">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-700"
                    src={vehicle.image}
                    alt={vehicle.alt}
                  />
                </div>
                <div className="flex-grow">
                  <div className={`${vehicle.tierColor} text-xs font-bold tracking-widest uppercase mb-2`}>{vehicle.tier}</div>
                  <h3 className="font-headline text-2xl font-bold mb-4">{vehicle.name}</h3>
                  <div className="space-y-3">
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Capacity</span>
                      <span className="font-medium">{vehicle.capacity}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Top Speed</span>
                      <span className="font-medium">{vehicle.speed}</span>
                    </div>
                    <div className="flex justify-between items-center text-sm">
                      <span className="text-on-surface-variant">Range</span>
                      <span className="font-medium">{vehicle.range}</span>
                    </div>
                  </div>
                </div>
                <button className="mt-8 w-full py-3 rounded-lg border border-primary/30 text-primary font-bold hover:bg-primary hover:text-on-primary transition-all">
                  Select Tier
                </button>
              </div>
            ))}
          </div>
        </section>

        {/* Ecosystem Intelligence */}
        <section className="py-24 px-12 bg-surface">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-20 items-center">
            <div>
              <h2 className="font-headline text-4xl font-bold mb-8 tracking-tight">Ecosystem Intelligence</h2>
              <div className="space-y-8">
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-primary">
                    <span className="material-symbols-outlined">bolt</span>
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">Universal Charging</h4>
                    <p className="text-on-surface-variant text-sm">Proprietary wireless kinetic charging pads integrated at every hub for 100% uptime.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-secondary">
                    <span className="material-symbols-outlined">precision_manufacturing</span>
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">Modular Cargo Hubs</h4>
                    <p className="text-on-surface-variant text-sm">Quick-swap container systems allow for vehicle transitions in under 120 seconds.</p>
                  </div>
                </div>
                <div className="flex gap-6">
                  <div className="w-12 h-12 rounded-lg bg-surface-container flex items-center justify-center text-tertiary">
                    <span className="material-symbols-outlined">radar</span>
                  </div>
                  <div>
                    <h4 className="font-bold mb-2">L5 Autonomy</h4>
                    <p className="text-on-surface-variant text-sm">Every vehicle equipped with multi-spectrum LiDAR and real-time neural navigation.</p>
                  </div>
                </div>
              </div>
            </div>
            <div className="relative">
              <div className="aspect-square rounded-2xl overflow-hidden glass-card p-4">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  className="w-full h-full object-cover rounded-xl opacity-60"
                  src="https://lh3.googleusercontent.com/aida-public/AB6AXuA94sg9bdZjiZcQcgGPu6BxAC41g33OnIdv7hBliqBOe87AlPk_PFk_inukpWTaYshpQg9SYDa2jJlLTfDzTEte1YEF89NRHDrnSGCLKCkJJHIM7mDPqaozugJbXliew3VPhPwrdelTblIdYOUx5rudoehBKbBUcYzCXWbnYUjCL8h9BKvhfHemYCdM-UO1llQvGaDn1uS7mUwWaTX27-7ZGqwtz4ejoSqyvoEPUM70dMMj7UWQhc76bfdxjTyKRa4_KkZPLTS68Q"
                  alt="High-tech vehicle interface"
                />
              </div>
              <div className="absolute -bottom-10 -left-10 glass-card p-8 rounded-2xl border border-primary/20">
                <div className="text-5xl font-black text-primary mb-1">99.9%</div>
                <div className="text-xs uppercase tracking-widest text-on-surface-variant">Autonomous Uptime</div>
              </div>
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-32 px-12 text-center bg-surface-container-low overflow-hidden relative">
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] bg-primary/10 blur-[120px] rounded-full pointer-events-none"></div>
          <div className="relative z-10 max-w-2xl mx-auto">
            <h2 className="font-headline text-5xl font-extrabold mb-6 tracking-tighter">Ready to optimize your velocity?</h2>
            <p className="text-on-surface-variant text-lg mb-10">
              Join the network of thousands of businesses scaling their logistics through the Kinetic Void ecosystem.
            </p>
            <div className="flex flex-col sm:flex-row justify-center gap-4">
              <button className="bg-primary text-on-primary font-bold px-10 py-4 rounded-lg active:scale-95 transition-all text-lg">Book Now</button>
              <button className="bg-surface-container-highest border border-[#494847] text-on-surface font-bold px-10 py-4 rounded-lg active:scale-95 transition-all text-lg">
                Contact Enterprise
              </button>
            </div>
          </div>
        </section>
      </main>

      <Footer />
    </div>
  )
}
