const steps = [
  {
    icon: 'touch_app',
    color: 'primary',
    title: 'Digital Request',
    description:
      'System-wide synchronization begins the moment you confirm your order. Our AI optimizes routes in real-time.',
  },
  {
    icon: 'package_2',
    color: 'secondary',
    title: 'Secure Induction',
    description:
      'Our kinetic agents arrive within 15 minutes for pickup, utilizing biometric verification for all transfers.',
  },
  {
    icon: 'rocket_launch',
    color: 'primary',
    title: 'Final Delivery',
    description:
      'Real-time GPS tracking and instant proof-of-delivery ensure your assets reach the destination flawlessly.',
  },
]

export default function HowItWorks() {
  return (
    <section className="px-8 py-24 bg-[#131313]">
      <div className="max-w-7xl mx-auto">
        <div className="mb-16">
          <h2 className="text-3xl font-black font-headline tracking-tight mb-4">
            Operational Protocol
          </h2>
          <p className="text-[#adaaaa]">Three phases to total logistical dominance.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {steps.map((step) => (
            <div
              key={step.title}
              className={`bg-[#1a1919] p-10 rounded-[2rem] border border-[#494847]/5 transition-all group ${
                step.color === 'primary'
                  ? 'hover:border-[#a3a6ff]/20'
                  : 'hover:border-[#c180ff]/20'
              }`}
            >
              <div
                className={`w-14 h-14 rounded-2xl flex items-center justify-center mb-8 group-hover:scale-110 transition-transform ${
                  step.color === 'primary' ? 'bg-[#a3a6ff]/10' : 'bg-[#c180ff]/10'
                }`}
              >
                <span
                  className={`material-symbols-outlined text-3xl ${
                    step.color === 'primary' ? 'text-[#a3a6ff]' : 'text-[#c180ff]'
                  }`}
                >
                  {step.icon}
                </span>
              </div>
              <h4 className="text-xl font-bold mb-4">{step.title}</h4>
              <p className="text-[#adaaaa] text-sm leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
