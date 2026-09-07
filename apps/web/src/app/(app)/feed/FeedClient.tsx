'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

interface Sender {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
  city_name: string | null
}

export interface RequestItem {
  id: string
  created_at: string
  sender: Sender
}

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}

interface Props {
  userId: string
  initialRequests: RequestItem[]
}

function RequestCard({ req, onRespond }: { req: RequestItem; onRespond: (id: string, action: 'accept' | 'decline') => void }) {
  const [state, setState] = useState<'idle' | 'loading'>('idle')
  const s = req.sender
  const rating = s.skill_level_computed ?? s.skill_level_self
  const initials = s.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  async function respond(action: 'accept' | 'decline') {
    if (state === 'loading') return
    setState('loading')
    onRespond(req.id, action)
  }

  return (
    <div className="px-4 py-4 border-b border-brand-divider">
      <div className="flex items-center gap-3">
        <Link href={`/profile/${s.username}`} className="w-12 h-12 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
          {s.avatar_url ? (
            <Image src={s.avatar_url} alt={s.full_name} width={48} height={48} className="w-full h-full object-cover" />
          ) : (
            <span className="font-display text-lg text-[rgba(26,26,26,0.3)]">{initials}</span>
          )}
        </Link>

        <div className="flex-1 min-w-0">
          <Link href={`/profile/${s.username}`} className="block font-display text-base tracking-wide leading-tight hover:text-brand-primary transition-colors">
            {s.full_name.toUpperCase()}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            {rating && (
              <span className="text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-1.5 py-0.5">
                {SKILL_LABELS[Math.round(rating * 2) / 2] ?? rating}
              </span>
            )}
            {s.city_name && (
              <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{s.city_name}</span>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => respond('accept')}
          disabled={state === 'loading'}
          className="flex-1 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
        >
          Accept
        </button>
        <button
          onClick={() => respond('decline')}
          disabled={state === 'loading'}
          className="flex-1 py-2.5 border border-brand-divider text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.4)] hover:text-[rgba(26,26,26,0.7)] transition-colors disabled:opacity-50"
        >
          Decline
        </button>
      </div>
    </div>
  )
}

export function FeedClient({ userId, initialRequests }: Props) {
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests)
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const channelName = useRef(`feed-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_requests', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as { id: string; sender_id: string; created_at: string }
          // Fetch sender profile
          const { data: sender } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name')
            .eq('id', row.sender_id)
            .single()
          if (!sender) return
          setRequests((prev) => {
            if (prev.some((r) => r.id === row.id)) return prev
            return [{ id: row.id, created_at: row.created_at, sender }, ...prev]
          })
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_requests', filter: `receiver_id=eq.${userId}` },
        (payload) => {
          const row = payload.new as { id: string; status: string }
          if (row.status !== 'pending') {
            setRequests((prev) => prev.filter((r) => r.id !== row.id))
          }
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  async function handleRespond(requestId: string, action: 'accept' | 'decline') {
    // Optimistically remove from list
    setRequests((prev) => prev.filter((r) => r.id !== requestId))

    const res = await fetch(`/api/game-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })

    if (res.ok && action === 'accept') {
      const data = await res.json() as { conversation_id?: string }
      if (data.conversation_id) {
        router.push(`/chats/${data.conversation_id}`)
        return
      }
    }

    if (!res.ok) {
      // Restore on error — just refresh
      router.refresh()
    }
  }

  if (requests.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">All quiet here</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          Game requests from other players will appear here.
        </p>
      </div>
    )
  }

  return (
    <div>
      <p className="px-4 pt-5 pb-2 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">
        Game requests
      </p>
      {requests.map((req) => (
        <RequestCard key={req.id} req={req} onRespond={handleRespond} />
      ))}
    </div>
  )
}
