'use client'

import { usePathname } from 'next/navigation'
import type { ReactNode } from 'react'
import { tabBarHiddenByPath } from './tab-bar'
import { useTabBarHidden } from './TabBarVisibility'

export function AppMain({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const { hidden } = useTabBarHidden()
  const reserveTabBar = !hidden && !tabBarHiddenByPath(pathname)

  return (
    <main
      className={`min-w-0 w-full max-w-full flex-1 md:ml-64 min-h-screen ${reserveTabBar ? 'pb-[var(--tab-bar-clearance)] md:pb-0' : ''}`}
    >
      {children}
    </main>
  )
}
