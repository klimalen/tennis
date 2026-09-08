'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Heart, MoreHorizontal, Pencil, Trash2, Trophy, Calendar, Loader2, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'

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

interface GameParticipant {
  player_id: string
  status: string
  profile: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
  }
}

interface GameDetail {
  id: string
  format: string
  scheduled_at: string
  skill_level_min: number | null
  skill_level_max: number | null
  neighborhood: string | null
  notes: string | null
  status: string
  max_players: number
  is_open: boolean
  creator_id: string
  creator: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
  }
  city: { name: string } | null
  participants: GameParticipant[]
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

// ─── Participant avatars ───────────────────────────────────────────────────────

function ParticipantAvatars({ participants, max = 4 }: { participants: GameParticipant[]; max?: number }) {
  const shown = participants.slice(0, max)
  const extra = participants.length - max
  return (
    <div className="flex items-center -space-x-2">
      {shown.map((p) => {
        const initials = p.profile.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
        return (
          <div key={p.player_id} className="w-6 h-6 border-2 border-white bg-brand-surface overflow-hidden flex items-center justify-center">
            {p.profile.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={p.profile.avatar_url} alt={p.profile.full_name} className="w-full h-full object-cover" />
            ) : (
              <span className="text-[7px] font-medium text-[rgba(26,26,26,0.5)]">{initials}</span>
            )}
          </div>
        )
      })}
      {extra > 0 && (
        <div className="w-6 h-6 border-2 border-white bg-brand-surface flex items-center justify-center">
          <span className="text-[7px] font-medium text-[rgba(26,26,26,0.5)]">+{extra}</span>
        </div>
      )}
    </div>
  )
}

// ─── Open game sheet ──────────────────────────────────────────────────────────

function OpenGameSheet({
  game,
  currentUserId,
  onClose,
  onJoined,
}: {
  game: GameDetail
  currentUserId: string
  onClose: () => void
  onJoined: () => void
}) {
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)

  const accepted = game.participants.filter((p) => p.status === 'accepted' || p.status === 'invited')
  const spotsTaken = accepted.length
  const spotsLeft = game.max_players - spotsTaken
  const isFull = spotsLeft <= 0
  const isParticipant = game.participants.some((p) => p.player_id === currentUserId)
  const isCreator = game.creator_id === currentUserId
  const alreadyIn = isParticipant || isCreator || joined
  const isPast = new Date(game.scheduled_at) < new Date()
  const isCancelled = game.status === 'cancelled'

  const creatorSkill = game.creator.skill_level_computed ?? game.creator.skill_level_self

  async function handleJoin() {
    if (joining || alreadyIn || isFull) return
    setJoining(true)
    const res = await fetch(`/api/games/${game.id}/join`, { method: 'POST' })
    if (res.ok) {
      setJoined(true)
      onJoined()
    }
    setJoining(false)
  }

  const joinLabel = alreadyIn ? "You're in" : isFull ? 'Game is full' : isPast ? 'Game passed' : isCancelled ? 'Cancelled' : 'Join game'

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-50 bg-brand-bg max-h-[85vh] overflow-y-auto md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-divider">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium">Open Game</span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 pb-24 space-y-5">
          {/* Date + format */}
          <div>
            <p className="font-display text-3xl tracking-wide leading-none text-[#1a1a1a]">
              <LocalGameDay iso={game.scheduled_at} /> <LocalGameMonth iso={game.scheduled_at} />
            </p>
            <p className="font-display text-xl tracking-wide text-brand-primary mt-1">
              <LocalGameTime iso={game.scheduled_at} />
            </p>
            <div className="flex items-center gap-3 mt-2 flex-wrap">
              <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[rgba(26,26,26,0.5)]">
                {FORMAT_LABELS[game.format] ?? game.format}
              </span>
              {(() => {
                const min = skillLabel(game.skill_level_min)
                const max = skillLabel(game.skill_level_max)
                const range = min && max ? `${min}–${max}` : (min ?? max ?? null)
                return range && (
                  <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[rgba(26,26,26,0.5)]">{range}</span>
                )
              })()}
              {game.neighborhood && (
                <span className="text-[11px] text-[rgba(26,26,26,0.5)] flex items-center gap-1">
                  <MapPin size={11} />{game.neighborhood}
                </span>
              )}
              {!isCancelled && !isPast && (
                <span className={`text-[9px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 ${
                  isFull ? 'bg-brand-surface text-[rgba(26,26,26,0.4)]' : 'bg-brand-primary/10 text-brand-primary'
                }`}>
                  {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
                </span>
              )}
              {isCancelled && (
                <span className="text-[9px] tracking-[0.1em] uppercase text-red-400 border border-red-200 px-2 py-0.5">Cancelled</span>
              )}
            </div>
            {game.notes && (
              <p className="mt-2 text-sm text-[rgba(26,26,26,0.55)] italic">{game.notes}</p>
            )}
          </div>

          {/* Organiser */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-2">Organiser</p>
            <Link href={`/profile/${game.creator.username}`} onClick={onClose} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                {game.creator.avatar_url ? (
                  <Image src={game.creator.avatar_url} alt={game.creator.full_name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-sm text-[rgba(26,26,26,0.3)]">
                    {game.creator.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
              <div>
                <p className="font-display text-base tracking-wide leading-tight">{game.creator.full_name.toUpperCase()}</p>
                {creatorSkill != null && (
                  <span className="text-[9px] tracking-[0.12em] uppercase text-brand-primary font-medium border border-brand-primary px-1.5 py-0.5">
                    {skillLabel(creatorSkill)}
                  </span>
                )}
              </div>
            </Link>
          </div>

          {/* Players */}
          {accepted.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-2">
                Players · {spotsTaken}/{game.max_players}
              </p>
              <div className="space-y-2">
                {accepted.map((p) => {
                  const pSkill = p.profile.skill_level_computed ?? p.profile.skill_level_self
                  const pInitials = p.profile.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                  return (
                    <Link key={p.player_id} href={`/profile/${p.profile.username}`} onClick={onClose}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity">
                      <div className="w-9 h-9 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                        {p.profile.avatar_url ? (
                          <Image src={p.profile.avatar_url} alt={p.profile.full_name} width={36} height={36} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-sm text-[rgba(26,26,26,0.3)]">{pInitials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{p.profile.full_name}</p>
                        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{p.profile.username}</p>
                      </div>
                      {pSkill != null && (
                        <span className="text-[9px] tracking-[0.1em] uppercase text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                          {skillLabel(pSkill)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* Join button */}
          <button
            onClick={handleJoin}
            disabled={alreadyIn || isFull || isPast || isCancelled || joining}
            className={`w-full py-4 text-[10px] tracking-[0.2em] uppercase font-medium transition-colors ${
              alreadyIn || isFull || isPast || isCancelled
                ? 'bg-brand-surface text-[rgba(26,26,26,0.35)] cursor-default'
                : 'bg-brand-primary text-white hover:bg-brand-primary-dark'
            }`}
          >
            {joining ? <Loader2 size={14} className="animate-spin mx-auto" /> : joinLabel}
          </button>
        </div>
      </div>
    </>
  )
}

// ─── Open game preview card ────────────────────────────────────────────────────

function OpenGameCard({
  game: basicGame,
  currentUserId,
}: {
  game: NonNullable<PostItem['game']>
  currentUserId: string
}) {
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const supabase = useRef(createClient()).current

  const isCancelled = basicGame.status === 'cancelled'
  const isPast = new Date(basicGame.scheduled_at) < new Date()
  const skillMin = skillLabel(basicGame.skill_level_min)
  const skillMax = skillLabel(basicGame.skill_level_max)
  const skillRange = skillMin && skillMax ? `${skillMin}–${skillMax}` : (skillMin ?? skillMax ?? null)

  useEffect(() => {
    supabase
      .from('games')
      .select(`
        id, format, scheduled_at, skill_level_min, skill_level_max,
        neighborhood, notes, status, max_players, is_open, creator_id,
        creator:profiles!creator_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed),
        city:cities (name),
        participants:game_participants (
          player_id, status,
          profile:profiles!player_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed)
        )
      `)
      .eq('id', basicGame.id)
      .single()
      .then(({ data }) => {
        if (data) setGameDetail(data as unknown as GameDetail)
      })
  }, [basicGame.id, supabase])

  const accepted = gameDetail?.participants.filter((p) => p.status === 'accepted' || p.status === 'invited') ?? []
  const spotsTaken = accepted.length
  const spotsLeft = gameDetail ? gameDetail.max_players - spotsTaken : basicGame.max_players
  const isFull = spotsLeft <= 0
  const isParticipant = gameDetail?.participants.some((p) => p.player_id === currentUserId) ?? false
  const isCreator = gameDetail?.creator_id === currentUserId
  const alreadyIn = isParticipant || isCreator

  const buttonLabel = alreadyIn ? "You're in" : isFull ? 'Full' : 'Join game'

  return (
    <>
      <button
        onClick={() => setShowSheet(true)}
        className="w-full text-left border border-brand-divider bg-brand-surface mb-3 hover:border-brand-primary/40 transition-colors"
      >
        <div className="px-4 py-3">
          {/* Header badge */}
          <div className="flex items-center gap-2 mb-2">
            <Calendar size={13} className="text-brand-primary flex-shrink-0" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-brand-primary font-medium">Open game</span>
            {isCancelled && (
              <span className="text-[8px] tracking-[0.1em] uppercase text-red-400 border border-red-200 px-1.5 py-0.5">Cancelled</span>
            )}
          </div>

          {/* Date + format */}
          <p className="font-display text-xl tracking-wide leading-none text-[#1a1a1a] mb-1">
            <LocalGameDay iso={basicGame.scheduled_at} /> <LocalGameMonth iso={basicGame.scheduled_at} /> · <LocalGameTime iso={basicGame.scheduled_at} />
          </p>
          <div className="flex items-center gap-2 text-[11px] text-[rgba(26,26,26,0.5)] flex-wrap">
            <span>{FORMAT_LABELS[basicGame.format] ?? basicGame.format}</span>
            {skillRange && <span>· {skillRange}</span>}
            {basicGame.neighborhood && (
              <span className="flex items-center gap-0.5"><MapPin size={9} />{basicGame.neighborhood}</span>
            )}
          </div>

          {/* Participants row */}
          <div className="flex items-center justify-between mt-3">
            <div className="flex items-center gap-2">
              {gameDetail ? (
                <>
                  <ParticipantAvatars participants={accepted} />
                  <span className="text-[10px] text-[rgba(26,26,26,0.4)]">{spotsTaken}/{basicGame.max_players}</span>
                </>
              ) : (
                <span className="text-[10px] text-[rgba(26,26,26,0.3)]">Up to {basicGame.max_players} players</span>
              )}
            </div>

            {/* Spots badge */}
            {!isCancelled && !isPast && gameDetail && (
              <span className={`text-[9px] tracking-[0.12em] uppercase font-medium px-2 py-0.5 ${
                isFull ? 'bg-brand-surface-md text-[rgba(26,26,26,0.35)]' : 'bg-brand-primary/10 text-brand-primary'
              }`}>
                {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''}`}
              </span>
            )}
          </div>
        </div>

        {/* Join / You're in strip */}
        {!isCancelled && !isPast && (
          <div
            onClick={(e) => {
              if (alreadyIn || isFull || !gameDetail) return
              e.stopPropagation()
              setShowSheet(true)
            }}
            className={`w-full py-2.5 text-center text-[10px] tracking-[0.2em] uppercase font-medium border-t border-brand-divider transition-colors ${
              alreadyIn
                ? 'text-[rgba(26,26,26,0.35)] bg-brand-surface cursor-default'
                : isFull
                  ? 'text-[rgba(26,26,26,0.3)] bg-brand-surface cursor-default'
                  : 'text-brand-primary hover:bg-brand-primary hover:text-white'
            }`}
          >
            {!gameDetail ? <Loader2 size={12} className="animate-spin inline" /> : buttonLabel}
          </div>
        )}
      </button>

      {showSheet && gameDetail && (
        <OpenGameSheet
          game={gameDetail}
          currentUserId={currentUserId}
          onClose={() => setShowSheet(false)}
          onJoined={() => {
            setGameDetail((prev) => prev ? {
              ...prev,
              participants: [...prev.participants, {
                player_id: currentUserId,
                status: 'accepted',
                profile: { id: currentUserId, full_name: '', username: '', avatar_url: null, skill_level_self: null, skill_level_computed: null },
              }],
            } : prev)
          }}
        />
      )}
    </>
  )
}

// ─── Match result card ────────────────────────────────────────────────────────

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
        {format && <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{FORMAT_LABELS[format] ?? format}</p>}
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
