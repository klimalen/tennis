'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface Badges { search: number; chats: number }

export function useNavBadges(): Badges {
  const [badges, setBadges] = useState<Badges>({ search: 0, chats: 0 })
  const pathname = usePathname()
  const channelName = useRef(`nav-badges-${Math.random().toString(36).slice(2)}`)

  async function fetchBadges() {
    try {
      const res = await fetch('/api/nav-badges')
      if (res.ok) setBadges(await res.json() as Badges)
    } catch { /* ignore */ }
  }

  useEffect(() => {
    fetchBadges()
  }, [pathname]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const id = setInterval(fetchBadges, 30_000)
    return () => clearInterval(id)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
