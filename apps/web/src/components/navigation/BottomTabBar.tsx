'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-config'
import { useNavBadges } from './useNavBadges'
import { CreateSheet } from './CreateSheet'

export function BottomTabBar() {
  const pathname = usePathname()
  const badges = useNavBadges()

  const leftItems = NAV_ITEMS.slice(0, 2)
  const rightItems = NAV_ITEMS.slice(2, 4)

  function badge(href: string) {
    if (href === '/feed' && badges.feed > 0) return badges.feed
    if (href === '/chats' && badges.chats > 0) return badges.chats
    return 0
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-brand-bg border-t border-brand-divider safe-area-pb">
      <div className="flex items-center justify-around h-16 px-2 max-w-lg mx-auto">
        {leftItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const count = badge(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 flex-1 py-2 relative"
            >
              <div className="relative">
                <Icon
                  size={20}
                  className={isActive ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-brand-primary" />
                )}
              </div>
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
          <CreateSheet variant="fab" />
        </div>

        {rightItems.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const count = badge(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className="flex flex-col items-center gap-1 flex-1 py-2"
            >
              <div className="relative">
                <Icon
                  size={20}
                  className={isActive ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.3)]'}
                  strokeWidth={isActive ? 2.5 : 1.8}
                />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-brand-primary" />
                )}
              </div>
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
