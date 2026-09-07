'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav-config'
import { useNavBadges } from './useNavBadges'

export function Sidebar() {
  const pathname = usePathname()
  const badges = useNavBadges()

  function badge(href: string) {
    if (href === '/feed') return badges.feed
    if (href === '/chats') return badges.chats
    return 0
  }

  return (
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-brand-bg border-r border-brand-divider z-40">
      {/* Logo */}
      <div className="px-6 py-5 border-b border-brand-divider">
        <Link href="/search" className="block">
          <span className="font-display text-4xl leading-none tracking-wide text-brand-primary">TENNIS</span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 py-4 space-y-0.5">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          const count = badge(item.href)
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-2.5 transition-colors ${
                isActive
                  ? 'bg-brand-surface text-brand-primary'
                  : 'text-[rgba(26,26,26,0.5)] hover:bg-brand-surface hover:text-[#1a1a1a]'
              }`}
            >
              <div className="relative">
                <Icon size={18} strokeWidth={isActive ? 2.5 : 1.8} />
                {count > 0 && (
                  <span className="absolute -top-1 -right-1.5 w-2 h-2 rounded-full bg-brand-primary" />
                )}
              </div>
              <span className={`text-xs tracking-[0.15em] uppercase ${isActive ? 'font-semibold' : 'font-medium'}`}>
                {item.label}
              </span>
            </Link>
          )
        })}
      </nav>

      {/* Create button */}
      <div className="px-3 pb-6">
        <Link
          href="/create"
          className="flex items-center justify-center gap-2 w-full py-3 bg-brand-primary text-white hover:bg-brand-primary-dark transition-colors"
        >
          <Plus size={16} strokeWidth={2.5} />
          <span className="text-xs tracking-[0.2em] uppercase font-medium">New Match</span>
        </Link>
      </div>
    </aside>
  )
}
