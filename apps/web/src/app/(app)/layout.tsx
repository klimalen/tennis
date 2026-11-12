import { AppMain } from '@/components/navigation/AppMain'
import { BottomTabBar } from '@/components/navigation/BottomTabBar'
import { Sidebar } from '@/components/navigation/Sidebar'
import { TabBarVisibility } from '@/components/navigation/TabBarVisibility'
import { TouchLastActive } from '@/components/presence/TouchLastActive'

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-screen w-full max-w-full overflow-x-clip bg-brand-bg">
      <TouchLastActive />
      <Sidebar />
      <TabBarVisibility>
        <AppMain>{children}</AppMain>
        <BottomTabBar />
      </TabBarVisibility>
    </div>
  )
}
