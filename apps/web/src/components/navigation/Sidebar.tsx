'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Plus } from 'lucide-react'
import { NAV_ITEMS } from './nav-config'

export function Sidebar() {
  const pathname = usePathname()

  return (
    <aside className="hidden md:flex flex-col fixed inset-y-0 left-0 w-64 bg-white border-r border-gray-100 z-40">
      {/* Logo */}
      <div className="px-6 py-6">
        <Link href="/search" className="flex items-center gap-2">
          <span className="text-2xl">🎾</span>
          <span className="text-xl font-bold text-gray-900 tracking-tight">Tennis</span>
        </Link>
      </div>

      {/* Nav items */}
      <nav className="flex-1 px-3 space-y-1">
        {NAV_ITEMS.map((item) => {
          const isActive = pathname === item.href
          const Icon = item.icon
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex items-center gap-3 px-3 py-3 rounded-xl transition-colors ${
                isActive
                  ? 'bg-green-50 text-green-700'
                  : 'text-gray-600 hover:bg-gray-50 hover:text-gray-900'
              }`}
            >
              <Icon
                size={20}
                strokeWidth={isActive ? 2.5 : 1.8}
              />
              <span className={`text-[15px] ${isActive ? 'font-semibold' : 'font-medium'}`}>
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
          className="flex items-center justify-center gap-2 w-full py-3 rounded-xl bg-green-600 text-white font-semibold text-sm hover:bg-green-700 transition-colors shadow-sm"
        >
          <Plus size={18} strokeWidth={2.5} />
          Create
        </Link>
      </div>
    </aside>
  )
}
