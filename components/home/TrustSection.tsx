const features = [
  {
    icon: 'shield_lock',
    title: 'End-to-End Encryption',
    description:
      'Every shipment is tracked via an encrypted ledger, ensuring data integrity from origin to destination.',
  },
  {
    icon: 'fingerprint',
    title: 'Identity Verification',
    description:
      'Couriers undergo multi-factor biometric authentication at every transition point in the journey.',
  },
  {
    icon: 'health_and_safety',
    title: 'Climate Control',
    description:
      'Our premium fleet features active environmental monitoring for sensitive pharmaceutical and tech cargo.',
  },
]

export default function TrustSection() {
  return (
    <section className="px-8 py-24 relative overflow-hidden">
      <div className="absolute top-0 right-0 w-1/2 h-full bg-[#a3a6ff]/5 blur-[120px] rounded-full -translate-y-1/2 pointer-events-none" />
      <div className="max-w-7xl mx-auto grid lg:grid-cols-2 gap-20 items-center">
        {/* Image */}
        <div className="relative aspect-square rounded-[3rem] overflow-hidden">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuCreGwQQ9snl-rqtptjDHd7Rl9amQgi1iyhP3iFJdCJfFUfdzLNdh7IWvvDJVV-BR40a7V-c_xUHjJN-lr7UOqzjJgOv0pmT4z0nCwc1DsNaBmUmeRIO3lHJtfXrq6AEh9S3Qt8aZU2D_l5MuFyTwJ8U8HBWSq3My5oAgF47rdw-Mb7nm8yY8qeUfTW_V4OtIuVKbjCTX6xovkutblwpmw6JNWczrBn8UL-CGFgLV0UpfYjUyJJjgO4Dj9EUh_SiA2G6yxDTPGNPA"
            alt="High-tech data server rack with glowing indicator lights"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent" />
          <div className="absolute bottom-10 left-10 right-10 glass-card p-6 rounded-2xl border border-[#494847]/20">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-[#c180ff] rounded-full text-[#33005b]">
                <span className="material-symbols-outlined">verified_user</span>
              </div>
              <div>
                <h5 className="font-bold">Encrypted Custody</h5>
                <p className="text-xs text-[#adaaaa]">Full liability insurance up to $500k</p>
              </div>
            </div>
          </div>
        </div>

        {/* Copy */}
        <div>
          <h2 className="text-4xl font-black font-headline tracking-tight mb-8">
            Fortress-Grade Security
          </h2>
          <ul className="space-y-8">
            {features.map((f) => (
              <li key={f.title} className="flex gap-6">
                <span className="material-symbols-outlined text-[#a3a6ff] mt-1">{f.icon}</span>
                <div>
                  <h6 className="font-bold mb-1">{f.title}</h6>
                  <p className="text-sm text-[#adaaaa]">{f.description}</p>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  )
}
