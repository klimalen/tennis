'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav-config'

export function BottomTabBar() {
  const pathname = usePathname()

  const leftItems = NAV_ITEMS.slice(0, 2)
  const rightItems = NAV_ITEMS.slice(2, 4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-brand-bg border-t border-brand-divider safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {leftItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 flex-1 py-2"
            >
              <Icon
                size={20}
                className={isActive ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={`text-[9px] tracking-[0.12em] uppercase font-medium ${
                isActive ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Center + button */}
        <div className="flex flex-col items-center flex-1">
          <Link
            href="/create"
            className="w-11 h-11 bg-brand-primary flex items-center justify-center shadow-lg -mt-5"
          >
            <Plus size={20} className="text-white" strokeWidth={2.5} />
          </Link>
        </div>

        {rightItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 flex-1 py-2"
            >
              <Icon
                size={20}
                className={isActive ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={`text-[9px] tracking-[0.12em] uppercase font-medium ${
                isActive ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'
              }`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
