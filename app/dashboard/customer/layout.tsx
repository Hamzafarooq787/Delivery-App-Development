import Sidebar from '@/components/customer/Sidebar'
import BottomNav from '@/components/customer/BottomNav'

export default function CustomerDashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen bg-surface-container-low">
      <Sidebar />
      <BottomNav />
      {children}
    </div>
  )
}
