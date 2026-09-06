'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav-config'

export function BottomTabBar() {
  const pathname = usePathname()

  // Split nav items: 2 left, 2 right (+ in center)
  const leftItems = NAV_ITEMS.slice(0, 2)
  const rightItems = NAV_ITEMS.slice(2, 4)

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-white border-t border-gray-100 safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {/* Left items */}
        {leftItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 flex-1 py-2"
            >
              <Icon
                size={22}
                className={isActive ? 'text-green-600' : 'text-gray-400'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}

        {/* Center + button */}
        <div className="flex flex-col items-center flex-1">
          <Link
            href="/create"
            className="w-12 h-12 rounded-full bg-green-600 flex items-center justify-center shadow-lg shadow-green-600/30 -mt-5"
          >
            <Plus size={22} className="text-white" strokeWidth={2.5} />
          </Link>
        </div>

        {/* Right items */}
        {rightItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-0.5 flex-1 py-2"
            >
              <Icon
                size={22}
                className={isActive ? 'text-green-600' : 'text-gray-400'}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span
                className={`text-[10px] font-medium ${
                  isActive ? 'text-green-600' : 'text-gray-400'
                }`}
              >
                {item.label}
              </span>
            </Link>
          )
        })}
      </div>
    </nav>
  )
}
