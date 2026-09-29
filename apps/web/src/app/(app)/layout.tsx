import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { Sidebar } from '@/components/navigation/Sidebar'
import { TabBarVisibility } from '@/components/navigation/TabBarVisibility'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-clip bg-brand-bg">
      <Sidebar />
      <TabBarVisibility>
        <main className="min-w-0 w-full max-w-full flex-1 md:ml-64 min-h-screen">
          {children}
        </main>
        <BottomTabBar />
      </TabBarVisibility>
    </div>
  )
}
