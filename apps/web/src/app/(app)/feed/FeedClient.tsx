'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, UserCheck } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

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

export interface FollowItem {
  followerId: string
  created_at: string
  isFollowingBack: boolean
  follower: Sender
}

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}

function Avatar({ user, size = 12 }: { user: Sender; size?: number }) {
  const initials = user.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  const px = size * 4
  return (
    <Link href={`/profile/${user.username}`} className={`w-${size} h-${size} bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0`}>
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt={user.full_name} width={px} height={px} className="w-full h-full object-cover" />
      ) : (
        <span className="font-display text-lg text-[rgba(26,26,26,0.3)]">{initials}</span>
      )}
    </Link>
  )
}

function SkillBadge({ user }: { user: Sender }) {
  const rating = user.skill_level_computed ?? user.skill_level_self
  if (!rating) return null
  const label = SKILL_LABELS[Math.round(rating * 2) / 2] ?? rating
  return (
    <span className="text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-1.5 py-0.5">
      {label}
    </span>
  )
}

// ─── Game request card ────────────────────────────────────────────────────────

function RequestCard({ req, onRespond }: { req: RequestItem; onRespond: (id: string, action: 'accept' | 'decline') => void }) {
  const [state, setState] = useState<'idle' | 'loading'>('idle')
  const s = req.sender

  async function respond(action: 'accept' | 'decline') {
    if (state === 'loading') return
    setState('loading')
    onRespond(req.id, action)
  }

  return (
    <div className="px-4 py-4 border-b border-brand-divider">
      <div className="flex items-center gap-3">
        <Avatar user={s} />
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${s.username}`} className="block font-display text-base tracking-wide leading-tight hover:text-brand-primary transition-colors">
            {s.full_name.toUpperCase()}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <SkillBadge user={s} />
            {s.city_name && (
              <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{s.city_name}</span>
            )}
          </div>
        </div>
        <span className="text-[8px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] font-medium flex-shrink-0">
          Play request
        </span>
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

// ─── Follow notification card ─────────────────────────────────────────────────

function FollowCard({ item, onFollowBack }: { item: FollowItem; onFollowBack: (id: string) => void }) {
  const [followingBack, setFollowingBack] = useState(item.isFollowingBack)
  const [loading, setLoading] = useState(false)
  const f = item.follower

  async function handleFollowBack() {
    if (loading || followingBack) return
    setLoading(true)
    setFollowingBack(true)
    const res = await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: f.id }),
    })
    if (!res.ok) setFollowingBack(false)
    else onFollowBack(f.id)
    setLoading(false)
  }

  return (
    <div className="px-4 py-4 border-b border-brand-divider">
      <div className="flex items-center gap-3">
        <Avatar user={f} />
        <div className="flex-1 min-w-0">
          <Link href={`/profile/${f.username}`} className="block font-display text-base tracking-wide leading-tight hover:text-brand-primary transition-colors">
            {f.full_name.toUpperCase()}
          </Link>
          <div className="flex items-center gap-2 mt-0.5">
            <SkillBadge user={f} />
            {f.city_name && (
              <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{f.city_name}</span>
            )}
          </div>
        </div>
        <span className="text-[8px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] font-medium flex-shrink-0">
          New follower
        </span>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={handleFollowBack}
          disabled={loading || followingBack}
          className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 text-[10px] tracking-[0.2em] uppercase font-medium transition-colors disabled:opacity-60 ${
            followingBack
              ? 'border border-brand-primary text-brand-primary'
              : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
          }`}
        >
          {followingBack ? <UserCheck size={12} /> : <UserPlus size={12} />}
          {followingBack ? 'Following' : 'Follow back'}
        </button>
        <Link
          href={`/profile/${f.username}`}
          className="flex-1 py-2.5 border border-brand-divider text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.4)] hover:text-[rgba(26,26,26,0.7)] transition-colors text-center"
        >
          View profile
        </Link>
      </div>
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface Props {
  userId: string
  initialRequests: RequestItem[]
  initialFollows: FollowItem[]
}

export function FeedClient({ userId, initialRequests, initialFollows }: Props) {
  const [requests, setRequests] = useState<RequestItem[]>(initialRequests)
  const [follows, setFollows] = useState<FollowItem[]>(initialFollows)
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const channelName = useRef(`feed-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      // New game request
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'game_requests', filter: `receiver_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as { id: string; sender_id: string; created_at: string }
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
      // Game request accepted/declined
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
      // New follower
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'follows', filter: `following_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as { follower_id: string; created_at: string }
          const { data: follower } = await supabase
            .from('profiles')
            .select('id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name')
            .eq('id', row.follower_id)
            .single()
          if (!follower) return
          setFollows((prev) => {
            if (prev.some((f) => f.followerId === row.follower_id)) return prev
            return [{ followerId: row.follower_id, created_at: row.created_at, isFollowingBack: false, follower }, ...prev]
          })
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  async function handleRespond(requestId: string, action: 'accept' | 'decline') {
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
    if (!res.ok) router.refresh()
  }

  function handleFollowBack(followerId: string) {
    setFollows((prev) => prev.map((f) =>
      f.followerId === followerId ? { ...f, isFollowingBack: true } : f,
    ))
  }

  // Merge and sort all items by created_at descending
  type FeedEntry =
    | { type: 'request'; item: RequestItem }
    | { type: 'follow'; item: FollowItem }

  const entries: FeedEntry[] = [
    ...requests.map((r): FeedEntry => ({ type: 'request', item: r })),
    ...follows.map((f): FeedEntry => ({ type: 'follow', item: f })),
  ].sort((a, b) => b.item.created_at.localeCompare(a.item.created_at))

  if (entries.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">All quiet here</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          Game requests and new followers will appear here.
        </p>
      </div>
    )
  }

  return (
    <div>
      {entries.map((entry) =>
        entry.type === 'request' ? (
          <RequestCard key={`req-${entry.item.id}`} req={entry.item} onRespond={handleRespond} />
        ) : (
          <FollowCard key={`follow-${entry.item.followerId}`} item={entry.item} onFollowBack={handleFollowBack} />
        ),
      )}
    </div>
  )
}
