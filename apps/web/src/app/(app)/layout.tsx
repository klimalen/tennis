import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { Sidebar } from '@/components/navigation/Sidebar'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-gray-50">
      {/* Desktop sidebar */}
      <Sidebar />

      {/* Main content */}
      <main className="flex-1 md:ml-64 min-h-screen">
        {children}
      </main>

      {/* Mobile bottom tab bar */}
      <BottomTabBar />
    </div>
  )
}
