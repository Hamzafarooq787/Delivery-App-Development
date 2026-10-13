import type { Metadata } from "next"
import Link from "next/link"
import BookingCard from "@/components/home/BookingCard"

export const metadata: Metadata = {
  title: "GoDrop | Local Collection, Delivery & Shopping Service",
  description:
    "Need something collected, delivered or bought from a shop? GoDrop makes local deliveries and everyday shopping requests simple.",
}

export default function HomePage() {
  return (
    <>
      {/* ── Hero ─────────────────────────────────────────────────────── */}
      <section className="relative min-h-[100svh] lg:min-h-[921px] flex items-center px-4 sm:px-8 py-24 lg:py-20 overflow-hidden">
        <div className="absolute inset-0 z-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="w-full h-full object-cover opacity-30"
            src="https://lh3.googleusercontent.com/aida-public/AB6AXuBbp_tdB9_mx8K3LMYJ9Dan4fK8pyGM9VXngSN3R6JcoaV0e3kau9IZrx4WiAmziCaQxUOcL-MuOELG0pZNeUlCJlcGSLBI2bvwLGBfBsIZbRDBLFVFY-mi4ZUjPZmjkLIEhGIOVqhji7-VAVGqT4YvonSSyhdvUpfRkDjdpvvGRqoVlxIPCYc1SXscy0dR5hjEu4n9hV-TQx4iYvarL9wsp3oWc5QXGY9ThK2-9aKUyLXI6Ihrb2tIYvhuKa21szWEadhDRhZu8g"
            alt="GoDrop delivery"
          />
          <div className="absolute inset-0 bg-gradient-to-r from-[#0e0e0e] via-[#0e0e0e]/80 to-transparent" />
        </div>
        <div className="relative z-10 max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-16 items-center w-full">
          <div>
            <span className="inline-block px-4 py-1 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold tracking-widest uppercase mb-6">
              Local Collection &amp; Delivery
            </span>
            <h1 className="text-4xl sm:text-5xl lg:text-7xl font-black font-headline text-white leading-tight tracking-tighter mb-6 lg:mb-8 text-balance">
              Need Something Moved?{" "}
              <span className="text-[#a3a6ff] italic">GoDrop It.</span>
            </h1>
            <p className="text-base sm:text-lg text-[#adaaaa] max-w-md leading-relaxed mb-8 lg:mb-10">
              Need to send a parcel, collect something you&apos;ve forgotten or get something from a shop?
              GoDrop makes everyday deliveries easier. Choose what you need, enter the details and book
              in a few simple steps.
            </p>
            <div className="flex flex-col sm:flex-row flex-wrap gap-3 sm:gap-4">
              <Link
                href="/signup"
                className="w-full sm:w-auto text-center px-8 py-4 milled-gradient rounded-full text-[#0f00a4] font-bold shadow-lg glow-primary active:scale-95 transition-transform"
              >
                Book a Delivery
              </Link>
              <Link
                href="/how-it-works"
                className="w-full sm:w-auto text-center px-8 py-4 bg-[#262626] border border-[#494847]/30 rounded-full text-white font-semibold hover:bg-[#262626]/80 transition-colors"
              >
                How It Works
              </Link>
            </div>
          </div>

          {/* Quick Book Widget */}
          <BookingCard />
        </div>
      </section>

      {/* ── Service Selection ─────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight mb-4">
              What Can We Do for You?
            </h2>
            <p className="text-[#adaaaa]">Choose the service that works for you.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-4xl mx-auto">
            {/* Collect & Deliver */}
            <div className="bg-[#1a1919] p-8 sm:p-10 rounded-[2rem] border border-[#494847]/5 hover:border-[#a3a6ff]/20 transition-all group flex flex-col">
              <div className="w-14 h-14 bg-[#a3a6ff]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl shrink-0">
                📦
              </div>
              <h3 className="text-xl font-bold mb-3">Collect &amp; Deliver</h3>
              <p className="text-[#adaaaa] text-sm leading-relaxed flex-1 mb-8">
                Need something collected and dropped off? From parcels and keys to gifts and everyday
                items, tell us where to collect it and where it needs to go.
              </p>
              <Link
                href="/signup"
                className="inline-block text-center w-full px-6 py-3 bg-[#a3a6ff] text-[#0f00a4] font-bold rounded-xl hover:brightness-110 transition-all"
              >
                Book a Collection
              </Link>
            </div>

            {/* Buy for Me */}
            <div className="bg-[#1a1919] p-8 sm:p-10 rounded-[2rem] border border-[#494847]/5 hover:border-[#c180ff]/20 transition-all group flex flex-col">
              <div className="w-14 h-14 bg-[#c180ff]/10 rounded-2xl flex items-center justify-center mb-6 group-hover:scale-110 transition-transform text-2xl shrink-0">
                🛍️
              </div>
              <h3 className="text-xl font-bold mb-3">Buy for Me</h3>
              <p className="text-[#adaaaa] text-sm leading-relaxed flex-1 mb-8">
                Need something from a shop but can&apos;t get there yourself? Tell us what you need,
                and a GoDrop driver can buy it and deliver it to your address.
              </p>
              <Link
                href="/signup"
                className="inline-block text-center w-full px-6 py-3 bg-[#c180ff] text-[#33005b] font-bold rounded-xl hover:brightness-110 transition-all"
              >
                Shop with GoDrop
              </Link>
            </div>
          </div>
        </div>
      </section>

      {/* ── Everyday Use Cases ────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-16">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight mb-4">
              Everyday Tasks Made Easier
            </h2>
            <p className="text-[#adaaaa]">
              GoDrop helps with the little things that make a big difference to your day.
            </p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {[
              { icon: "📬", title: "Send a Parcel", desc: "Get your parcel collected and delivered." },
              { icon: "🔑", title: "Forgotten Keys", desc: "Arrange a collection when you've left something behind." },
              { icon: "🎁", title: "Send a Gift", desc: "Surprise someone with a thoughtful delivery." },
              { icon: "🛒", title: "Marketplace Collection", desc: "Arrange pickup of an item you've purchased." },
              { icon: "💼", title: "Business Deliveries", desc: "Send documents, parcels and everyday supplies." },
              { icon: "🏪", title: "Shop Collection", desc: "Get something collected from a local shop." },
              { icon: "🎒", title: "Forgotten Items", desc: "Have something important brought to you." },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-[#1a1919] p-6 rounded-2xl border border-[#494847]/5 hover:border-[#a3a6ff]/15 transition-all"
              >
                <span className="text-2xl mb-4 block">{item.icon}</span>
                <h4 className="font-bold mb-2 text-sm">{item.title}</h4>
                <p className="text-[#adaaaa] text-xs leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── How GoDrop Works ─────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight mb-4">
              How GoDrop Works
            </h2>
            <p className="text-[#adaaaa]">Book in a few simple steps.</p>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                step: "01",
                icon: "👆",
                title: "Choose Your Service",
                desc: "Select Collect & Deliver or Buy for Me.",
              },
              {
                step: "02",
                icon: "📝",
                title: "Tell Us the Details",
                desc: "Enter the collection or shop details, delivery address and any instructions.",
              },
              {
                step: "03",
                icon: "✅",
                title: "Confirm Your Booking",
                desc: "Review the available price and booking details before confirming.",
              },
              {
                step: "04",
                icon: "📍",
                title: "Follow Your Delivery",
                desc: "Check your delivery progress and receive updates until your order is complete.",
              },
            ].map((item) => (
              <div
                key={item.step}
                className="bg-[#1a1919] p-7 sm:p-8 rounded-[2rem] border border-[#494847]/5 hover:border-[#a3a6ff]/20 transition-all group"
              >
                <div className="flex items-start justify-between mb-6">
                  <div className="w-12 h-12 bg-[#a3a6ff]/10 rounded-2xl flex items-center justify-center group-hover:scale-110 transition-transform text-xl">
                    {item.icon}
                  </div>
                  <span className="text-[#494847] font-headline font-black text-3xl">{item.step}</span>
                </div>
                <h4 className="text-base font-bold mb-3">{item.title}</h4>
                <p className="text-[#adaaaa] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
          <div className="mt-10 text-center">
            <Link
              href="/how-it-works"
              className="inline-block px-8 py-3 border border-[#a3a6ff]/30 text-[#a3a6ff] rounded-full text-sm font-semibold hover:bg-[#a3a6ff]/10 transition-colors"
            >
              See full guide
            </Link>
          </div>
        </div>
      </section>

      {/* ── Buy for Me Feature ───────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-[#c180ff]/5 blur-[120px] rounded-full -translate-y-1/2 pointer-events-none" />
        <div className="max-w-7xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-10 lg:gap-20 items-center">
          <div className="relative aspect-square rounded-[3rem] overflow-hidden order-2 lg:order-1">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              className="w-full h-full object-cover"
              src="https://lh3.googleusercontent.com/aida-public/AB6AXuCreGwQQ9snl-rqtptjDHd7Rl9amQgi1iyhP3iFJdCJfFUfdzLNdh7IWvvDJVV-BR40a7V-c_xUHjJN-lr7UOqzjJgOv0pmT4z0nCwc1DsNaBmUmeRIO3lHJtfXrq6AEh9S3Qt8aZU2D_l5MuFyTwJ8U8HBWSq3My5oAgF47rdw-Mb7nm8yY8qeUfTW_V4OtIuVKbjCTX6xovkutblwpmw6JNWczrBn8UL-CGFgLV0UpfYjUyJJjgO4Dj9EUh_SiA2G6yxDTPGNPA"
              alt="Shopping delivery"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-[#0e0e0e] via-transparent" />
            <div className="absolute bottom-4 sm:bottom-10 left-4 sm:left-10 right-4 sm:right-10 glass-card p-4 sm:p-6 rounded-2xl border border-[#494847]/20">
              <div className="flex items-center gap-4">
                <div className="p-3 bg-[#c180ff] rounded-full text-[#33005b] shrink-0">🛍️</div>
                <div>
                  <h5 className="font-bold text-sm">Buy for Me</h5>
                  <p className="text-xs text-[#adaaaa]">Tell us what you need and where to get it</p>
                </div>
              </div>
            </div>
          </div>
          <div className="order-1 lg:order-2">
            <span className="inline-block px-4 py-1 rounded-full bg-[#c180ff]/10 border border-[#c180ff]/20 text-[#c180ff] text-xs font-bold tracking-widest uppercase mb-6">
              Personal Shopping
            </span>
            <h2 className="text-3xl sm:text-4xl font-black font-headline tracking-tight mb-6 text-balance">
              Need Something from a Shop?
            </h2>
            <p className="text-[#adaaaa] mb-6 leading-relaxed">
              No time to visit the shop? GoDrop can help. Tell us what you need, where to buy it and
              where to deliver it. Add item details and instructions so your driver knows exactly what
              to collect.
            </p>
            <ul className="space-y-4 mb-8">
              {[
                "Tell us the shop and what you need",
                "Add item details and any special instructions",
                "Your driver collects it and delivers to your door",
              ].map((point) => (
                <li key={point} className="flex gap-3 items-start text-sm text-[#adaaaa]">
                  <span className="text-[#c180ff] mt-0.5 shrink-0">✓</span>
                  {point}
                </li>
              ))}
            </ul>
            <Link
              href="/signup"
              className="inline-block px-8 py-4 bg-[#c180ff] text-[#33005b] font-bold rounded-full hover:brightness-110 transition-all"
            >
              Try Buy for Me
            </Link>
          </div>
        </div>
      </section>

      {/* ── Trust Section ─────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
        <div className="max-w-7xl mx-auto">
          <div className="mb-10 sm:mb-16 text-center">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight mb-4">
              A Delivery Service You Can Rely On
            </h2>
            <p className="text-[#adaaaa]">Simple, clear and built around your needs.</p>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
            {[
              {
                icon: "⚡",
                color: "[#a3a6ff]",
                bg: "[#a3a6ff]/10",
                title: "Easy Booking",
                desc: "Book your collection or delivery in a few simple steps.",
              },
              {
                icon: "📍",
                color: "[#c180ff]",
                bg: "[#c180ff]/10",
                title: "Delivery Updates",
                desc: "Stay informed about your order's progress.",
              },
              {
                icon: "📋",
                color: "[#a3a6ff]",
                bg: "[#a3a6ff]/10",
                title: "Clear Booking Details",
                desc: "Review your delivery information before confirming.",
              },
              {
                icon: "✅",
                color: "[#c180ff]",
                bg: "[#c180ff]/10",
                title: "Delivery Confirmation",
                desc: "Know when your delivery has been completed.",
              },
            ].map((item) => (
              <div
                key={item.title}
                className="bg-[#1a1919] p-7 rounded-[2rem] border border-[#494847]/5 hover:border-[#a3a6ff]/20 transition-all"
              >
                <div className={`w-14 h-14 bg-${item.bg} rounded-2xl flex items-center justify-center mb-6 text-2xl`}>
                  {item.icon}
                </div>
                <h4 className="font-bold mb-2">{item.title}</h4>
                <p className="text-[#adaaaa] text-sm leading-relaxed">{item.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── FAQ ───────────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24">
        <div className="max-w-3xl mx-auto">
          <div className="mb-10 sm:mb-12 text-center">
            <h2 className="text-2xl sm:text-3xl font-black font-headline tracking-tight mb-4">
              Frequently Asked Questions
            </h2>
          </div>
          <div className="space-y-3">
            {[
              {
                q: "What is GoDrop?",
                a: "GoDrop is a local collection and delivery service that helps you send items, arrange collections and request personal shopping.",
              },
              {
                q: "What is Collect & Deliver?",
                a: "It lets you arrange for an item to be collected from one location and delivered to another.",
              },
              {
                q: "What is Buy for Me?",
                a: "It allows you to request items from a shop and arrange delivery to your address.",
              },
              {
                q: "How much does a delivery cost?",
                a: "Enter your booking details to check the available price before confirming.",
              },
              {
                q: "Can I track my delivery?",
                a: "You can check your order progress through the tracking features available in your GoDrop account.",
              },
              {
                q: "Where is GoDrop available?",
                a: "Service availability depends on the locations supported by GoDrop. Check availability when booking.",
              },
            ].map((item) => (
              <details
                key={item.q}
                className="bg-[#1a1919] rounded-2xl border border-[#494847]/10 group open:border-[#a3a6ff]/20 transition-colors"
              >
                <summary className="flex items-center justify-between px-6 py-5 cursor-pointer list-none select-none">
                  <span className="font-semibold text-sm pr-4">{item.q}</span>
                  <span className="material-symbols-outlined text-[#adaaaa] shrink-0 group-open:rotate-45 transition-transform">
                    add
                  </span>
                </summary>
                <p className="px-6 pb-5 text-sm text-[#adaaaa] leading-relaxed border-t border-[#494847]/10 pt-4">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final CTA ─────────────────────────────────────────────────── */}
      <section className="px-4 sm:px-8 py-16 sm:py-24 bg-[#131313]">
        <div className="max-w-2xl mx-auto text-center">
          <span className="inline-block px-4 py-1 rounded-full bg-[#a3a6ff]/10 border border-[#a3a6ff]/20 text-[#a3a6ff] text-xs font-bold tracking-widest uppercase mb-6">
            Get Started
          </span>
          <h2 className="text-3xl sm:text-4xl font-black font-headline tracking-tight mb-6 text-balance">
            Ready to Get Started?
          </h2>
          <p className="text-[#adaaaa] mb-8 leading-relaxed">
            From everyday collections to shopping requests, GoDrop helps you get things where they
            need to go.
          </p>
          <Link
            href="/signup"
            className="inline-block px-10 py-4 milled-gradient rounded-full text-[#0f00a4] font-bold shadow-lg glow-primary active:scale-95 transition-transform"
          >
            Book with GoDrop
          </Link>
        </div>
      </section>
    </>
  )
}
