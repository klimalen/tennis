'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { UserPlus, UserCheck } from 'lucide-react'
import { formatPlayFormat, skillLabel } from '@/lib/skill'
import {
  NOTIFICATION_PAGE_SIZE,
  mapNotification,
  pageFromRows,
  type NotificationActor,
  type NotificationCursor,
  type NotificationItem,
  type NotificationKind,
  type NotificationPayload,
  type NotificationRow,
} from './notifications'

function Avatar({ user }: { user: NotificationActor }) {
  const initials = user.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  return (
    <Link href={`/profile/${user.username}`} className="w-12 h-12 rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0">
      {user.avatar_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={user.avatar_url} alt={user.full_name} width={48} height={48} className="w-full h-full object-cover" />
      ) : (
        <span className="font-display text-lg text-[#1a1a1a]">{initials}</span>
      )}
    </Link>
  )
}

function SkillBadge({ user }: { user: NotificationActor }) {
  const rating = user.skill_level_computed ?? user.skill_level_self
  const label = skillLabel(rating)
  if (!label) return null
  return (
    <span className="rounded-full text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-2 py-0.5">
      {label}
    </span>
  )
}

const KIND_LABEL: Record<NotificationKind, string> = {
  follow: 'New follower',
  request: 'Wants to play',
  request_accepted: 'Accepted',
  request_declined: 'Declined',
  game_invite: 'Invite',
  game_updated: 'Updated',
  game_cancelled: 'Cancelled',
  game_joined: 'Joined',
  game_left: 'Left',
}

function gameSummary(payload: NotificationPayload): string | null {
  const parts: string[] = []
  if (payload.scheduled_at) {
    const dt = new Date(payload.scheduled_at)
    if (!Number.isNaN(dt.getTime())) {
      parts.push(dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }))
      parts.push(dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }))
    }
  }
  if (payload.format) parts.push(formatPlayFormat(payload.format))
  if (payload.location) parts.push(payload.location)
  return parts.length > 0 ? parts.join(' · ') : null
}

function detailLine(kind: NotificationKind): string | null {
  switch (kind) {
    case 'request':
      return 'Wants to play. Accept to open a chat — you will follow each other.'
    case 'request_accepted':
      return 'Accepted your request to play.'
    case 'request_declined':
      return 'Declined your request to play.'
    case 'game_invite':
      return 'Invited you to a game.'
    case 'game_updated':
      return 'Changed the game details.'
    case 'game_cancelled':
      return 'Cancelled the game.'
    case 'game_joined':
      return 'Joined your game.'
    case 'game_left':
      return 'Left your game.'
    default:
      return null
  }
}

function NotificationCard({
  item,
  onRespond,
  onFollowBack,
}: {
  item: NotificationItem
  onRespond: (requestId: string, action: 'accept' | 'decline') => Promise<void>
  onFollowBack: (actorId: string) => void
}) {
  const actor = item.actor
  const [acting, setActing] = useState<'accept' | 'decline' | null>(null)
  const [followingBack, setFollowingBack] = useState(item.followingBack)
  const [followLoading, setFollowLoading] = useState(false)
  const summary = gameSummary(item.payload)
  const detail = detailLine(item.kind)
  const name = actor?.full_name?.toUpperCase() || 'SOMEONE'

  async function respond(action: 'accept' | 'decline') {
    const requestId = item.payload.request_id
    if (!requestId || acting) return
    setActing(action)
    await onRespond(requestId, action)
    setActing(null)
  }

  async function handleFollowBack() {
    if (!actor || followLoading || followingBack) return
    setFollowLoading(true)
    setFollowingBack(true)
    const res = await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: actor.id }),
    })
    if (!res.ok) setFollowingBack(false)
    else onFollowBack(actor.id)
    setFollowLoading(false)
  }

  return (
    <div className="mx-4 mb-3 mt-3 px-4 py-4 rounded-[28px] bg-white">
      <div className="flex items-center gap-3">
        {actor ? <Avatar user={actor} /> : (
          <div className="w-12 h-12 rounded-full bg-[#E8748A] flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          {actor ? (
            <Link href={`/profile/${actor.username}`} className="block font-display text-base tracking-wide leading-tight hover:text-brand-primary transition-colors">
              {name}
            </Link>
          ) : (
            <p className="font-display text-base tracking-wide leading-tight">{name}</p>
          )}
          {actor && (
            <div className="flex items-center gap-2 mt-0.5">
              <SkillBadge user={actor} />
              {actor.city_name && (
                <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{actor.city_name}</span>
              )}
            </div>
          )}
          {detail && (
            <p className="text-[12px] text-[rgba(26,26,26,0.55)] mt-1">{detail}</p>
          )}
          {summary && (
            <p className="text-[12px] text-[#1a1a1a] mt-1">{summary}</p>
          )}
        </div>
        <span className="text-[8px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] font-medium flex-shrink-0">
          {KIND_LABEL[item.kind] ?? 'Update'}
        </span>
      </div>

      {item.kind === 'request' && item.payload.request_id && (
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
      )}

      {item.kind === 'follow' && actor && (
        <div className="flex gap-2 mt-3">
          <button
            onClick={() => void handleFollowBack()}
            disabled={followLoading || followingBack}
            className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-full text-[10px] tracking-[0.2em] uppercase font-medium transition-colors disabled:opacity-60 ${
              followingBack
                ? 'border border-brand-primary text-brand-primary bg-white'
                : 'bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'
            }`}
          >
            {followingBack ? <UserCheck size={12} /> : <UserPlus size={12} />}
            {followingBack ? 'Following' : 'Follow back'}
          </button>
          <Link
            href={`/profile/${actor.username}`}
            className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors text-center"
          >
            View profile
          </Link>
        </div>
      )}

      {item.kind !== 'follow' && item.kind !== 'request' && actor && (
        <div className="mt-3">
          <Link
            href={`/profile/${actor.username}`}
            className="block w-full py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors text-center"
          >
            View profile
          </Link>
        </div>
      )}
    </div>
  )
}

interface Props {
  userId: string
  initialItems: NotificationItem[]
  initialCursor: NotificationCursor | null
}

export function FeedClient({ userId, initialItems, initialCursor }: Props) {
  const [items, setItems] = useState<NotificationItem[]>(initialItems)
  const [cursor, setCursor] = useState<NotificationCursor | null>(initialCursor)
  const [loadingMore, setLoadingMore] = useState(false)
  const router = useRouter()
  const supabase = useRef(createClient()).current
  const channelName = useRef(`feed-${Math.random().toString(36).slice(2)}`)

  useEffect(() => {
    const channel = supabase
      .channel(channelName.current)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        async (payload) => {
          const row = payload.new as {
            id: string
            kind: string
            game_id: string | null
            payload: NotificationPayload | null
            created_at: string
            actor_id: string | null
          }
          const { data: actor } = row.actor_id
            ? await supabase
                .from('profiles')
                .select('id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name')
                .eq('id', row.actor_id)
                .maybeSingle()
            : { data: null }
          const { data: follow } = row.actor_id
            ? await supabase
                .from('follows')
                .select('follower_id')
                .eq('follower_id', userId)
                .eq('following_id', row.actor_id)
                .maybeSingle()
            : { data: null }

          const item = mapNotification({
            id: row.id,
            kind: row.kind,
            game_id: row.game_id,
            payload: row.payload,
            created_at: row.created_at,
            actor_id: actor?.id ?? null,
            actor_full_name: actor?.full_name ?? null,
            actor_username: actor?.username ?? null,
            actor_avatar_url: actor?.avatar_url ?? null,
            actor_skill_self: actor?.skill_level_self ?? null,
            actor_skill_computed: actor?.skill_level_computed ?? null,
            actor_city: actor?.city_name ?? null,
            following_back: Boolean(follow),
          })
          setItems((prev) => (prev.some((entry) => entry.id === item.id) ? prev : [item, ...prev]))
        },
      )
      .on(
        'postgres_changes',
        { event: 'DELETE', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          const id = (payload.old as { id?: string }).id
          if (!id) return
          setItems((prev) => prev.filter((entry) => entry.id !== id))
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    const { data, error } = await supabase.rpc('list_notifications', {
      p_before: cursor.at,
      p_before_id: cursor.id,
      p_limit: NOTIFICATION_PAGE_SIZE + 1,
    })
    if (error) {
      setLoadingMore(false)
      return
    }
    const { items: next, nextCursor } = pageFromRows((data ?? []) as NotificationRow[])
    setItems((prev) => {
      const seen = new Set(prev.map((entry) => entry.id))
      return [...prev, ...next.filter((entry) => !seen.has(entry.id))]
    })
    setCursor(nextCursor)
    setLoadingMore(false)
  }

  async function handleRespond(requestId: string, action: 'accept' | 'decline') {
    const res = await fetch(`/api/game-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action }),
    })
    if (!res.ok) return
    setItems((prev) => prev.filter((entry) => entry.payload.request_id !== requestId))
    if (action === 'accept') {
      const data = await res.json() as { conversation_id?: string }
      if (data.conversation_id) router.push(`/chats/${data.conversation_id}`)
    }
  }

  function handleFollowBack(actorId: string) {
    setItems((prev) => prev.map((entry) =>
      entry.actor?.id === actorId && entry.kind === 'follow'
        ? { ...entry, followingBack: true }
        : entry,
    ))
  }

  if (items.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">All quiet here</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          Requests, game invites, and new followers will appear here
        </p>
      </div>
    )
  }

  return (
    <div>
      {items.map((item) => (
        <NotificationCard
          key={item.id}
          item={item}
          onRespond={handleRespond}
          onFollowBack={handleFollowBack}
        />
      ))}
      {cursor && (
        <div className="px-4 pt-1 pb-6">
          <button
            type="button"
            onClick={() => void loadMore()}
            disabled={loadingMore}
            className="w-full py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] hover:bg-white transition-colors disabled:opacity-50"
          >
            {loadingMore ? 'Loading…' : 'Show more'}
          </button>
        </div>
      )}
    </div>
  )
}
