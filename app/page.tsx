import Header from '@/components/layout/Header'
import Footer from '@/components/layout/Footer'
import BottomNav from '@/components/layout/BottomNav'
import Hero from '@/components/home/Hero'
import HowItWorks from '@/components/home/HowItWorks'
import TrustSection from '@/components/home/TrustSection'
import FleetSection from '@/components/home/FleetSection'

export default function HomePage() {
  return (
    <>
      <Header />
      <main className="pt-16 min-h-screen">
        <Hero />
        <HowItWorks />
        <TrustSection />
        <FleetSection />
      </main>
      <Footer />
      <BottomNav />
    </>
  )
}
