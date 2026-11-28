'use client'

import { useEffect, useRef, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, Heart, Lock, MoreHorizontal, Pencil, Trash2, Trophy, Users, Loader2 } from 'lucide-react'
import { viewerCanWriteRecap } from '@/lib/game-recap'
import { holdsGameSeat } from '@/lib/schedule'
import { createClient } from '@/lib/supabase/client'
import { GameDetailSheet, loadGameDetail, viewerCanOpenGame, type GameDetail } from '@/components/games/GameDetailSheet'
import { GameRecapCard } from '@/components/games/GameRecapCard'
import { OpenGameTicketCard } from '@/components/games/OpenGameTicketCard'
import { formatRecapDate } from '@/components/ui/LocalGameTime'
import type { PostItem } from '@/lib/post-feed'

export type { PostItem }

// ─── Helpers ──────────────────────────────────────────────────────────────────

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
  group: 'Group',
}

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

// ─── Open game preview card (same ticket as Discover → Games) ─────────────────

function OpenGameCard({
  game: basicGame,
  currentUserId,
}: {
  game: NonNullable<PostItem['game']>
  currentUserId: string
}) {
  const [gameDetail, setGameDetail] = useState<GameDetail | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const router = useRouter()
  const [canJoin, setCanJoin] = useState<boolean | null>(null)

  const isCancelled = basicGame.status === 'cancelled'
  const isPast = new Date(basicGame.scheduled_at) < new Date()
  const placeName = gameDetail?.court?.name?.trim() || basicGame.neighborhood?.trim() || ''
  const title = placeName || gameDetail?.creator.full_name || 'Open game'

  useEffect(() => {
    let cancelled = false
    void loadGameDetail(basicGame.id).then((data) => {
      if (!cancelled && data) setGameDetail(data)
    })
    return () => { cancelled = true }
  }, [basicGame.id])

  useEffect(() => {
    if (!currentUserId) {
      setCanJoin(true)
      return
    }
    let cancelled = false
    const supabase = createClient()
    void supabase
      .from('profiles')
      .select('account_kind')
      .eq('id', currentUserId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setCanJoin(data?.account_kind !== 'court')
      })
    return () => { cancelled = true }
  }, [currentUserId])

  const accepted = gameDetail?.participants.filter((p) => holdsGameSeat(p.status) && p.profile.account_kind !== 'court') ?? []
  const spotsTaken = accepted.length
  const spotsLeft = gameDetail ? gameDetail.max_players - spotsTaken : basicGame.max_players
  const isFull = spotsLeft <= 0
  const isParticipant = gameDetail?.participants.some((p) => p.player_id === currentUserId && holdsGameSeat(p.status)) ?? false
  const isCreator = (gameDetail?.creator_id ?? basicGame.creator_id) === currentUserId
  const alreadyIn = isParticipant || isCreator
  const courtHost = gameDetail?.creator.account_kind === 'court'
  const faces = gameDetail
    ? [
        ...(courtHost ? [] : [{
          id: gameDetail.creator.id,
          name: gameDetail.creator.full_name,
          avatarUrl: gameDetail.creator.avatar_url,
        }]),
        ...accepted
          .filter((person) => person.player_id !== gameDetail.creator_id)
          .map((person) => ({
            id: person.player_id,
            name: person.profile.full_name,
            avatarUrl: person.profile.avatar_url,
          })),
      ]
    : []

  const muted = isCancelled || isPast
  const canRecap = Boolean(gameDetail && viewerCanWriteRecap(gameDetail, currentUserId))
  const beard = canRecap
    ? 'recap' as const
    : muted || canJoin === false
      ? null
      : !gameDetail
        ? null
        : alreadyIn
          ? 'in' as const
          : isFull
            ? 'full' as const
            : 'join' as const

  function openSheet() {
    if (gameDetail && !viewerCanOpenGame(gameDetail, currentUserId)) return
    setShowSheet(true)
  }

  return (
    <div className="mb-3">
      <OpenGameTicketCard
        title={title}
        format={basicGame.format}
        scheduledAt={basicGame.scheduled_at}
        durationMinutes={gameDetail?.duration_minutes ?? null}
        courtCostCents={gameDetail?.court_cost_cents ?? null}
        costCurrency={gameDetail?.cost_currency ?? null}
        courtFee={gameDetail?.court?.fee ?? null}
        faces={faces}
        spotsLeft={spotsLeft}
        isFull={isFull}
        beard={beard}
        muted={muted}
        badge={isCancelled ? 'Cancelled' : isPast ? 'Past' : null}
        onOpen={openSheet}
        onJoin={openSheet}
        onRecap={() => router.push(`/games/${basicGame.id}/recap`)}
      />

      {showSheet && gameDetail && viewerCanOpenGame(gameDetail, currentUserId) && (
        <GameDetailSheet
          game={gameDetail}
          currentUserId={currentUserId}
          {...(canJoin == null ? {} : { viewerIsCourt: !canJoin })}
          onClose={() => setShowSheet(false)}
          onCancelled={() => {
            setShowSheet(false)
            setGameDetail(null)
          }}
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
          onLeft={() => {
            setGameDetail((prev) => prev ? {
              ...prev,
              participants: prev.participants.filter((participant) => participant.player_id !== currentUserId),
            } : prev)
          }}
        />
      )}
    </div>
  )
}

// ─── Match result card ────────────────────────────────────────────────────────

function MatchResultCard({ matchResult }: { matchResult: NonNullable<PostItem['match_result']> }) {
  const format = matchResult.game?.format
  const date = matchResult.played_at ?? matchResult.game?.scheduled_at
  const winner = matchResult.winner

  return (
    <div className="rounded-[20px] bg-brand-field px-4 py-3 mb-3">
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

function PostMenu({
  postId,
  gameId,
  recap,
  onDeleted,
}: {
  postId: string
  gameId?: string | null
  recap?: boolean
  onDeleted: () => void
}) {
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
        <div className="absolute top-full right-0 mt-1 bg-white border border-[#1a1a1a]/10 rounded-2xl shadow-lg z-30 min-w-[140px] overflow-hidden">
          <button
            onClick={() => {
              setOpen(false)
              router.push(recap && gameId ? `/games/${gameId}/recap` : `/feed/${postId}/edit`)
            }}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[11px] text-[rgba(26,26,26,0.7)] hover:bg-brand-surface transition-colors"
          >
            <Pencil size={13} />
            {recap ? 'Edit recap' : 'Edit post'}
          </button>
          <button
            onClick={handleDelete}
            className="w-full flex items-center gap-2.5 px-4 py-2.5 text-left text-[11px] text-red-500 hover:bg-red-50 transition-colors"
          >
            <Trash2 size={13} />
            {recap ? 'Delete recap' : 'Delete post'}
          </button>
        </div>
      )}
    </div>
  )
}

function RecapPhotos({ urls }: { urls: string[] }) {
  const scroller = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(0)
  const many = urls.length > 1

  function readIndex() {
    const node = scroller.current
    const slide = node?.firstElementChild as HTMLElement | null
    if (!node || !slide) return
    const step = slide.offsetWidth + 8
    if (step <= 0) return
    const next = Math.min(urls.length - 1, Math.max(0, Math.round(node.scrollLeft / step)))
    setIndex((current) => (current === next ? current : next))
  }

  function go(next: number) {
    const node = scroller.current
    const slide = node?.children[next] as HTMLElement | undefined
    if (!node || !slide) return
    node.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' })
  }

  if (!many) {
    const only = urls[0]
    if (!only) return null
    return (
      <div className="relative mb-3 aspect-square overflow-hidden rounded-[20px] bg-brand-field">
        <Image src={only} alt="" fill sizes="(max-width: 672px) 100vw, 640px" className="object-cover" />
      </div>
    )
  }

  return (
    <div className="mb-3">
      <div className="relative">
        <div
          ref={scroller}
          onScroll={readIndex}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Recap photos"
        >
          {urls.map((url) => (
            <div key={url} className="relative aspect-square w-[84%] flex-none snap-start overflow-hidden rounded-[20px] bg-brand-field">
              <Image src={url} alt="" fill sizes="(max-width: 672px) 84vw, 540px" className="object-cover" />
            </div>
          ))}
        </div>
        <span className="pointer-events-none absolute left-3 top-3 rounded-full bg-[#1a1a1a]/55 px-2 py-1 text-[10px] font-medium tracking-[0.08em] text-white">
          {index + 1} / {urls.length}
        </span>
      </div>
      <div className="mt-2.5 flex items-center justify-center gap-1.5">
        {urls.map((url, dot) => (
          <button
            key={url}
            type="button"
            aria-label={`Photo ${dot + 1} of ${urls.length}`}
            onClick={() => go(dot)}
            className={`h-1.5 rounded-full transition-all ${dot === index ? 'w-4 bg-[#1a1a1a]' : 'w-1.5 bg-[#1a1a1a]/25'}`}
          />
        ))}
      </div>
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
  const isRecap = post.type === 'game_recap'
  const initials = post.author.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
  const photos = post.image_urls.length > 0 ? post.image_urls : post.image_url ? [post.image_url] : []
  const canOpenRecap = isRecap && post.can_open_game

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
    <div className="mb-3 px-4 py-4 rounded-[28px] bg-white">
      {/* Author header */}
      <div className="flex items-start gap-3 mb-3">
        <Link href={`/profile/${post.author.username}`} className="flex-shrink-0">
          <div className="w-10 h-10 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center">
            {post.author.avatar_url ? (
              <Image src={post.author.avatar_url} alt={post.author.full_name} width={40} height={40} className="w-full h-full object-cover" />
            ) : (
              <span className="font-display text-sm text-[#1a1a1a]">{initials}</span>
            )}
          </div>
        </Link>

        <div className="flex-1 min-w-0 pt-0.5">
          <Link href={`/profile/${post.author.username}`} className="hover:text-brand-primary transition-colors">
            <span className="font-display text-sm tracking-wide text-[#1a1a1a]">{post.author.full_name.toUpperCase()}</span>
          </Link>
          <p className="mt-0.5 flex items-center gap-1 text-[10px] text-[rgba(26,26,26,0.4)]">
            {isRecap && post.game?.scheduled_at ? (
              <>
                <span>{formatRecapDate(post.game.scheduled_at, 'long')}</span>
                <span aria-hidden>·</span>
                {post.visibility === 'public' ? <Globe size={10} /> : post.visibility === 'private' ? <Lock size={10} /> : <Users size={10} />}
                <span>{post.visibility === 'public' ? 'Public' : post.visibility === 'private' ? 'Private' : 'Friends'}</span>
              </>
            ) : timeAgo(post.created_at)}
          </p>
        </div>

        {isOwn && (post.type === 'manual' || isRecap) && (
          <PostMenu
            postId={post.id}
            gameId={post.game?.id ?? null}
            recap={isRecap}
            onDeleted={() => onDeleted?.(post.id)}
          />
        )}
      </div>

      {/* Type-specific card */}
      {post.type === 'match_result' && post.match_result && (
        <MatchResultCard matchResult={post.match_result} />
      )}
      {post.type === 'open_game' && post.game && (
        <OpenGameCard game={post.game} currentUserId={currentUserId} />
      )}

      {isRecap && photos.length > 0 && <RecapPhotos urls={photos} />}

      {/* Body text */}
      {post.body && (
        <p className="font-copy text-sm text-[rgba(26,26,26,0.85)] leading-relaxed mb-3 whitespace-pre-wrap">{post.body}</p>
      )}

      {isRecap && post.game && (
        <GameRecapCard
          gameId={post.game.id}
          scheduledAt={post.game.scheduled_at}
          players={post.recap_players}
          canOpen={canOpenRecap}
        />
      )}

      {!isRecap && photos.length > 0 && <RecapPhotos urls={photos} />}

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
          <span className="text-[11px] font-medium">{likesCount} {likesCount === 1 ? 'like' : 'likes'}</span>
        )}
      </button>
    </div>
  )
}
