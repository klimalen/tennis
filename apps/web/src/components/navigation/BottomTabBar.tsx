'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { NAV_ITEMS } from './nav-config'
import { useNavBadges } from './useNavBadges'
import { CreateSheet } from './CreateSheet'
import { useTabBarHidden } from './TabBarVisibility'

export function BottomTabBar() {
  const pathname = usePathname()
  const { hidden } = useTabBarHidden()
  const badges = useNavBadges()

  const leftItems = NAV_ITEMS.slice(0, 2)
  const rightItems = NAV_ITEMS.slice(2, 4)

  function badge(href: string) {
    if (href === '/search' && badges.search > 0) return badges.search
    if (href === '/chats' && badges.chats > 0) return badges.chats
    return 0
  }

  const hideBar =
    hidden ||
    pathname === '/games/new' ||
    pathname === '/feed/new' ||
    pathname === '/settings' ||
    pathname === '/me/edit' ||
    (pathname.startsWith('/chats/') && pathname.length > '/chats/'.length)

  if (hideBar) return null

  function itemLink(item: (typeof NAV_ITEMS)[number]) {
    const isActive = pathname === item.href
    const Icon = item.icon
    const count = badge(item.href)
    return (
      <Link
        key={item.href}
        href={item.href}
        className="flex flex-1 flex-col items-center gap-0.5 py-2"
      >
        <span className="relative">
          <Icon
            size={20}
            className={isActive ? 'text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.4)]'}
            strokeWidth={isActive ? 2.4 : 1.8}
          />
          {count > 0 && (
            <span className="absolute -top-0.5 -right-1.5 h-2 w-2 rounded-full bg-[#E8748A]" />
          )}
        </span>
        <span className={`text-[10px] font-medium ${isActive ? 'text-[#1a1a1a]' : 'text-[rgba(26,26,26,0.4)]'}`}>
          {item.label}
        </span>
      </Link>
    )
  }

  return (
    <nav
      className="pointer-events-none fixed inset-x-0 bottom-0 z-50 md:hidden"
      style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 10px)' }}
    >
      <div className="pointer-events-auto mx-auto mb-2 w-[min(100%-1.25rem,32rem)]">
        <div className="relative">
          <div className="flex h-[62px] [filter:drop-shadow(0_8px_18px_rgba(26,26,26,0.12))]">
            <div className="min-w-0 flex-1 rounded-l-full bg-white" />
            <svg
              width="112"
              height="62"
              viewBox="0 0 112 62"
              className="-mx-px block shrink-0"
              aria-hidden="true"
            >
              <path
                fill="white"
                d="M0 0H18C26 0 20 41 56 41C92 41 86 0 94 0H112V62H0Z"
              />
            </svg>
            <div className="min-w-0 flex-1 rounded-r-full bg-white" />
          </div>
          <div className="absolute inset-0 flex items-center">
            <div className="flex min-w-0 flex-1">{leftItems.map(itemLink)}</div>
            <div className="w-[112px] shrink-0" aria-hidden="true" />
            <div className="flex min-w-0 flex-1">{rightItems.map(itemLink)}</div>
          </div>
          <div className="absolute left-1/2 top-[-14px] -ml-6">
            <CreateSheet variant="fab" />
          </div>
        </div>
      </div>
    </nav>
  )
}
