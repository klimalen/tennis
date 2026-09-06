import { Search, Newspaper, CalendarDays, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Search',   href: '/search',   icon: Search },
  { label: 'Feed',     href: '/feed',     icon: Newspaper },
  { label: 'Schedule', href: '/schedule', icon: CalendarDays },
  { label: 'Me',       href: '/me',       icon: User },
]
