'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Badges { feed: number; chats: number }

export function useNavBadges(): Badges {
  const [badges, setBadges] = useState<Badges>({ feed: 0, chats: 0 })
  const pathname = usePathname()
  // Unique channel name per hook instance to avoid Supabase reusing subscribed channels
  const channelName = useRef(`nav-badges-${Math.random().toString(36).slice(2)}`)

  async function fetchBadges() {
    try {
      const res = await fetch('/api/nav-badges')
      if (res.ok) setBadges(await res.json() as Badges)
    } catch { /* ignore */ }
  }

  // Re-fetch on every navigation
  useEffect(() => {
    fetchBadges()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  // Poll every 30s as fallback
  useEffect(() => {
    const id = setInterval(fetchBadges, 30_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Real-time: re-fetch when new messages or read status changes
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel(channelName.current)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, fetchBadges)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'game_requests' }, fetchBadges)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'game_requests' }, fetchBadges)
      .on('postgres_changes', { event: 'UPDATE', schema: 'public', table: 'conversation_participants' }, fetchBadges)
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return badges
}
