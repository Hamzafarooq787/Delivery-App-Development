const fleetItems = [
  {
    label: 'Ground Unit',
    labelColor: 'text-[#a3a6ff]',
    title: 'Stealth Runner',
    subtitle: 'Agile city-navigation',
    offset: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCVVk9QV_vBG7xfICXQ259DaN2Jj3AMol0grVXQQHgi5pAPENx9mn_825laj0AIFjaqyvn4YjaPPsUtgvpRwdK_Jmt4CO2SqwrBRLR_k8Xxlb_Z-B4hrkGfPPlXDzDJypTkGejsk17q7i-E80a2-rfqnupRzYXDNgrtvCFLiZi59aRKXBqzGP13OrbHTRk2pxH0ih0qJ_SA-7Ot7SwrwMA3xbTVQ23pDACQ0uLgiXfLhKxy1mQTlg4sIOPuxzDcksDuiWZ_zzGyKQ',
    alt: 'Sleek black modern cargo vans parked in a clean warehouse',
  },
  {
    label: 'Heavy Transit',
    labelColor: 'text-[#c180ff]',
    title: 'Titan Carrier',
    subtitle: 'Bulk industrial logistics',
    offset: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCPkpY080fdCq9JZSqOGDwk3yi93pyRBFRSVNYCzpO5hRSkemTrJWcv_ynmwrddvUFI45FarTyOxb393sXJLtgIj0i9WKA49EnkeGQ2X_q04r-NNm-3fopxQ6U04jnjuUwNZC659bYSnYMIVNXHFAknMw-J6_5mFGHpaRltUQnndkEoU84778mm6UuTpHp6gTQ23FjhcszOtI78DENFYA7oPGYsu4xHW5pZXg3IeeLhsKBP7ChNu6PzK0qWfavHhO89-y2-HY0EuQ',
    alt: 'Heavy duty electric cargo truck on a mountain highway at twilight',
  },
  {
    label: 'Airborne',
    labelColor: 'text-[#a3a6ff]',
    title: 'Aero-Drone V2',
    subtitle: 'Instant short-range drop',
    offset: false,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuCeN46UzNkG4RJ6i1sQOW8eogNnhnraBQnHjQKjLwt6PIPFklTZ4XEvh14HT73GZpyQQZXh6hn9A6zQ2IfxdgQAXWHoozkurktVaa6vBk_lwWmVgqXOeBq10EO0msUudNdDVcXQmGnpghHvmDJxLqNRMLgy3Fnf1L1B1k9z7ORjE20rofHj1PKX6dBALAYNoDbZz3TS3r2v3t8p-RKo9GOunEaUNBXe1z2nDsI5hsyuvBOgqBuxYl41f4pA7Zssf49jvGe19DDK0Q',
    alt: 'Modern white delivery drone flying against a clear blue sky',
  },
  {
    label: 'Hyper-Local',
    labelColor: 'text-[#c180ff]',
    title: 'Velocity Bike',
    subtitle: 'Zero-emission precision',
    offset: true,
    image:
      'https://lh3.googleusercontent.com/aida-public/AB6AXuAEK71nwZrjCR5ABm0FlIlqYYQ0vKUuUoBmCk7ZfJWuFxjD6lnBELw_fB59msqxTVBJZkHroJEMN4NPwR-u2maKUi8CWkHfHO3FC8yVwRs5Y-d2YjVmvoPSbmuSbjw5HpfzrqlfFBY_r9DZCkBzATDEOeO666Y3yeqzIst5Qd06Gp86EPWkwxTR2BYN8WBJu5LEXEslIIuPwjtIDVEj9DEPzCG7BE_fSJtR1RoR7K7Ujr7wZf7Mo21og1OqWUGVNMbF9tusXK8gDA',
    alt: 'Professional courier on high-end electric bicycle in urban environment',
  },
]

export default function FleetSection() {
  return (
    <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-10 sm:mb-16">
          <h2 className="text-3xl sm:text-4xl font-black font-headline tracking-tight mb-4 text-balance">
            The Kinetic Global Fleet
          </h2>
          <p className="text-[#adaaaa]">Strategically positioned to respond in milliseconds.</p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {fleetItems.map((item) => (
            <div
              key={item.title}
              className={`group relative h-[320px] sm:h-[400px] rounded-[2rem] overflow-hidden${
                item.offset ? ' lg:mt-12' : ''
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                className="w-full h-full object-cover transition-transform duration-700 group-hover:scale-110"
                src={item.image}
                alt={item.alt}
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black via-transparent to-transparent opacity-80" />
              <div className="absolute bottom-0 left-0 p-8">
                <span className={`text-[10px] uppercase font-bold tracking-widest mb-2 block ${item.labelColor}`}>
                  {item.label}
                </span>
                <h5 className="text-xl font-bold">{item.title}</h5>
                <p className="text-xs text-gray-400 mt-2">{item.subtitle}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
