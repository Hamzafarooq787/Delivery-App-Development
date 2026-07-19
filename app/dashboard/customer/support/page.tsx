import Header from "@/components/customer/Header"
import { getMyTickets } from "@/app/actions/driver"
import { SupportPanel } from "@/components/driver/support-panel"

export const dynamic = "force-dynamic"

export default async function CustomerSupportPage() {
  const { data: tickets } = await getMyTickets()

  return (
    <>
      <Header />
      <main className="pt-16 pb-28 md:pb-8 px-4 md:px-8 md:ml-64 min-h-screen bg-[#0e0e0e]">
        <div className="max-w-5xl mx-auto pt-5 md:pt-8">
          <SupportPanel
            initialTickets={tickets}
            subtitle="Get help with your deliveries and account."
            showChatHint={false}
          />
        </div>
      </main>
    </>
  )
}
