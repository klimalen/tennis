'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, MoreHorizontal, Pencil, Trash2, Trophy, Calendar, Loader2, Users } from 'lucide-react'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface PostItem {
  id: string
  type: 'manual' | 'match_result' | 'open_game'
  body: string | null
  image_url: string | null
  created_at: string
  author: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
  }
  match_result: {
    id: string
    winner_id: string | null
    winning_team: number | null
    played_at: string | null
    winner: { full_name: string; username: string } | null
    game: { format: string; scheduled_at: string } | null
  } | null
  game: {
    id: string
    format: string
    scheduled_at: string
    skill_level_min: number | null
    skill_level_max: number | null
    neighborhood: string | null
    status: string
    max_players: number
    is_open: boolean
    city: { name: string } | null
  } | null
  likes_count: number
  liked_by_me: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime()
  const mins = Math.floor(diff / 60000)
  if (mins < 1) return 'just now'
  if (mins < 60) return `${mins}m`
  const hours = Math.floor(mins / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  if (days < 7) return `${days}d`
  return new Date(dateStr).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed doubles',
}

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}

function skillLabel(v: number | null) {
  if (!v) return null
  return SKILL_LABELS[Math.round(v * 2) / 2] ?? v.toFixed(1)
}

// ─── Sub-cards ────────────────────────────────────────────────────────────────

function MatchResultCard({ matchResult }: { matchResult: NonNullable<PostItem['match_result']> }) {
  const format = matchResult.game?.format
  const date = matchResult.played_at ?? matchResult.game?.scheduled_at
  const winner = matchResult.winner

  return (
    <div className="border border-brand-divider bg-brand-surface px-4 py-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Trophy size={13} className="text-brand-primary flex-shrink-0" />
        <span className="text-[9px] tracking-[0.2em] uppercase text-brand-primary font-medium">Match result</span>
      </div>
      <div className="space-y-1">
        {format && (
          <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{FORMAT_LABELS[format] ?? format}</p>
        )}
        {date && (
          <p className="text-[11px] text-[rgba(26,26,26,0.5)]">
            {new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
          </p>
        )}
        {winner && (
          <p className="text-sm font-medium text-[#1a1a1a] mt-1">
            Winner: <Link href={`/profile/${winner.username}`} className="hover:text-brand-primary transition-colors">{winner.full_name}</Link>
          </p>
        )}
      </div>
    </div>
  )
}

function OpenGameCard({
  game,
  currentUserId,
}: {
  game: NonNullable<PostItem['game']>
  currentUserId: string
}) {
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const router = useRouter()

  const isCancelled = game.status === 'cancelled'
  const isPast = new Date(game.scheduled_at) < new Date()
  const skillMin = skillLabel(game.skill_level_min)
  const skillMax = skillLabel(game.skill_level_max)
  const skillRange = skillMin && skillMax ? `${skillMin}–${skillMax}` : (skillMin ?? skillMax ?? null)
  const location = [game.neighborhood, game.city?.name].filter(Boolean).join(', ')

  async function handleJoin() {
    if (joining || joined) return
    setJoining(true)
    const res = await fetch(`/api/games/${game.id}/join`, { method: 'POST' })
    if (res.ok) {
      setJoined(true)
      router.refresh()
    }
    setJoining(false)
  }

  return (
    <div className="border border-brand-divider bg-brand-surface px-4 py-3 mb-3">
      <div className="flex items-center gap-2 mb-2">
        <Calendar size={13} className="text-brand-primary flex-shrink-0" />
        <span className="text-[9px] tracking-[0.2em] uppercase text-brand-primary font-medium">Open game</span>
        {isCancelled && (
          <span className="text-[8px] tracking-[0.1em] uppercase text-red-400 border border-red-200 px-1.5 py-0.5">Cancelled</span>
        )}
      </div>

      <div className="space-y-1 mb-3">
        <p className="text-sm font-medium text-[#1a1a1a]">
          {FORMAT_LABELS[game.format] ?? game.format}
          {skillRange && <span className="font-normal text-[rgba(26,26,26,0.5)]"> · {skillRange}</span>}
        </p>
        <p className="text-[11px] text-[rgba(26,26,26,0.5)]">
          {new Date(game.scheduled_at).toLocaleDateString('en-US', {
            weekday: 'short', month: 'short', day: 'numeric',
          })}
          {' · '}
          {new Date(game.scheduled_at).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: false })}
        </p>
        {location && (
          <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{location}</p>
        )}
        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">
          <Users size={10} className="inline mr-1" />
          Up to {game.max_players} players
        </p>
      </div>

      {!isCancelled && !isPast && game.is_open && (
        <button
          onClick={handleJoin}
          disabled={joining || joined}
          className="w-full py-2 border border-brand-primary text-brand-primary text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary hover:text-white transition-colors disabled:opacity-50"
        >
          {joining ? <Loader2 size={12} className="animate-spin mx-auto" /> : joined ? 'Joined ✓' : 'Join game'}
        </button>
      )}
    </div>
  )
}

// ─── Post menu (edit / delete) ────────────────────────────────────────────────

function PostMenu({ postId, onDeleted }: { postId: string; onDeleted: () => void }) {
  const [open, setOpen] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)
  const router = useRouter()

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function handleDelete() {
    setOpen(false)
    setDeleting(true)
    const res = await fetch(`/api/posts/${postId}`, { method: 'DELETE' })
    if (res.ok) onDeleted()
    setDeleting(false)
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setOpen((v) => !v)}
        disabled={deleting}
        className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.3)] hover:text-[rgba(26,26,26,0.7)] transition-colors"
      >
        {deleting ? <Loader2 size={14} className="animate-spin" /> : <MoreHorizontal size={16} />}
      </button>

      {open && (
        <div className="absolute top-full right-0 mt-1 bg-brand-bg border border-brand-divider shadow-lg z-30 min-w-[140px]">
          <button
            onClick={() => { setOpen(false); router.push(`/feed/${postId}/edit`) }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[11px] text-[rgba(26,26,26,0.7)] hover:bg-brand-surface transition-colors"
          >
            <Pencil size={13} />
            Edit post
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[11px] text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            Delete post
          </button>
        </div>
      )}
    </div>
  )
}

// ─── Main PostCard ─────────────────────────────────────────────────────────────

export function PostCard({
  post,
  currentUserId,
  onDeleted,
}: {
  post: PostItem
  currentUserId: string
  onDeleted?: (postId: string) => void
}) {
  const [liked, setLiked] = useState(post.liked_by_me)
  const [likesCount, setLikesCount] = useState(post.likes_count)
  const isOwn = post.author.id === currentUserId
  const initials = post.author.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  async function toggleLike() {
    const newLiked = !liked
    setLiked(newLiked)
    setLikesCount((c) => newLiked ? c + 1 : c - 1)
    const res = await fetch(`/api/posts/${post.id}/like`, { method: 'POST' })
    if (!res.ok) {
      setLiked(liked)
      setLikesCount(likesCount)
    }
  }

  return (
    <div className="border-b border-brand-divider px-4 py-4">
      {/* Author header */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${post.author.username}`} className="flex-shrink-0">
          <div className="w-10 h-10 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center">
            {post.author.avatar_url ? (
              <Image src={post.author.avatar_url} alt={post.author.full_name} width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-sm text-[rgba(26,26,26,0.3)]">{initials}</span>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0 pt-0.5">
          <Link href={`/profile/${post.author.username}`} className="hover:text-brand-primary transition-colors">
            <span className="font-display text-sm tracking-wide text-[#1a1a1a]">{post.author.full_name.toUpperCase()}</span>
          </Link>
          <p className="text-[10px] text-[rgba(26,26,26,0.4)] mt-0.5">{timeAgo(post.created_at)}</p>
        </div>

        {isOwn && post.type === 'manual' && (
          <PostMenu postId={post.id} onDeleted={() => onDeleted?.(post.id)} />
        )}
      </div>

      {/* Type-specific card */}
      {post.type === 'match_result' && post.match_result && (
        <MatchResultCard matchResult={post.match_result} />
      )}
      {post.type === 'open_game' && post.game && (
        <OpenGameCard game={post.game} currentUserId={currentUserId} />
      )}

      {/* Body text */}
      {post.body && (
        <p className="text-sm text-[rgba(26,26,26,0.85)] leading-relaxed mb-3 whitespace-pre-wrap">{post.body}</p>
      )}

      {/* Image */}
      {post.image_url && (
        <div className="relative w-full aspect-video bg-brand-surface overflow-hidden mb-3">
          <Image src={post.image_url} alt="Post image" fill className="object-cover" />
        </div>
      )}

      {/* Like button */}
      <button
        onClick={toggleLike}
        className="flex items-center gap-1.5 text-[rgba(26,26,26,0.4)] hover:text-brand-primary transition-colors mt-1"
      >
        <Heart
          size={16}
          className={liked ? 'fill-brand-primary text-brand-primary' : ''}
          strokeWidth={liked ? 0 : 1.8}
        />
        {likesCount > 0 && (
          <span className="text-[11px] font-medium">{likesCount}</span>
        )}
      </button>
    </div>
  )
}
