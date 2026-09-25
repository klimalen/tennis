import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { Sidebar } from '@/components/navigation/Sidebar'
import { TabBarVisibility } from '@/components/navigation/TabBarVisibility'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen bg-brand-bg">
      <Sidebar />
      <TabBarVisibility>
        <main className="flex-1 md:ml-64 min-h-screen">
          {children}
        </main>
        <BottomTabBar />
      </TabBarVisibility>
    </div>
  )
}
