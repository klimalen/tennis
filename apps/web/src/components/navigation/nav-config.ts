import { Search, Newspaper, MessageCircle, User } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

export interface NavItem {
  label: string
  href: string
  icon: LucideIcon
}

export const NAV_ITEMS: NavItem[] = [
  { label: 'Search', href: '/search',   icon: Search },
  { label: 'Feed',   href: '/feed',     icon: Newspaper },
  { label: 'Chats',  href: '/chats',    icon: MessageCircle },
  { label: 'Me',     href: '/me',       icon: User },
]
