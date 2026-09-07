'use client'

import { useEffect, useState, useRef } from 'react'
import { usePathname } from 'next/navigation'

interface Badges { feed: number; chats: number }

export function useNavBadges(): Badges {
  const [badges, setBadges] = useState<Badges>({ feed: 0, chats: 0 })
  const pathname = usePathname()
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  async function fetchBadges() {
    try {
      const res = await fetch('/api/nav-badges')
      if (res.ok) {
        const data = await res.json() as Badges
        setBadges(data)
      }
    } catch {
      // ignore
    }
  }

  useEffect(() => {
    fetchBadges()
    intervalRef.current = setInterval(fetchBadges, 30_000)
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  // Re-fetch when user navigates (e.g. leaves feed, clears badge)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname])

  return badges
}
