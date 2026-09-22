'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, UserCheck } from 'lucide-react'
import { skillLabel } from '@/lib/skill'

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

function Avatar({ user, size = 12 }: { user: Sender; size?: number }) {
  const initials = user.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  const px = size * 4
  return (
    <Link href={`/profile/${user.username}`} className={`w-${size} h-${size} rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0`}>
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt={user.full_name} width={px} height={px} className="w-full h-full object-cover" />
      ) : (
        <span className="font-display text-lg text-[#1a1a1a]">{initials}</span>
      )}
    </Link>
  )
}

function SkillBadge({ user }: { user: Sender }) {
  const rating = user.skill_level_computed ?? user.skill_level_self
  const label = skillLabel(rating)
  if (!label) return null
  return (
    <span className="text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-1.5 py-0.5">
      {label}
    </span>
  )
}

// ─── Game request card ────────────────────────────────────────────────────────

function RequestCard({ req, onRespond }: { req: RequestItem; onRespond: (id: string, action: 'accept' | 'decline') => Promise<void> }) {
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const s = req.sender

  async function respond(action: 'accept' | 'decline') {
    if (acting) return
    setActing(action)
    await onRespond(req.id, action)
    setActing(null)
  }

  return (
    <div className="mx-4 mb-3 px-4 py-4 rounded-[28px] bg-white">
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
          <p className="text-[12px] text-[rgba(26,26,26,0.55)] mt-1">Wants to play. Accept to open a chat — you will follow each other.</p>
        </div>
      </div>

      <div className="flex gap-2 mt-3">
        <button
          onClick={() => void respond('accept')}
          disabled={acting !== null}
          className="flex-1 py-2.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-50"
        >
          {acting === 'accept' ? 'Opening chat…' : 'Accept'}
        </button>
        <button
          onClick={() => void respond('decline')}
          disabled={acting !== null}
          className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors disabled:opacity-50"
        >
          {acting === 'decline' ? 'Declining…' : 'Decline'}
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
    <div className="mx-4 mb-3 px-4 py-4 rounded-[28px] bg-white">
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
              : 'rounded-full bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'
          }`}
        >
          {followingBack ? <UserCheck size={12} /> : <UserPlus size={12} />}
          {followingBack ? 'Following' : 'Follow back'}
        </button>
        <Link
          href={`/profile/${f.username}`}
          className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors text-center"
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
    const res = await fetch(`/api/game-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) return
    if (action === 'accept') {
      const data = await res.json() as { conversation_id?: string }
      if (data.conversation_id) {
        router.push(`/chats/${data.conversation_id}`)
        return
      }
    }
    setRequests((prev) => prev.filter((r) => r.id !== requestId))
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
          Game requests and new followers will appear here
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
