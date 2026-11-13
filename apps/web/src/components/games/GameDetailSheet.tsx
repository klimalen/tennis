'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ArrowLeft, ChevronDown, Globe, Loader2, MapPin, Phone, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LocalGameDay, LocalGameMonth, LocalGameTimeRange } from '@/components/ui/LocalGameTime'
import { ShareLinkButton } from '@/components/share/ShareLinkButton'
import { holdsGameSeat } from '@/lib/schedule'
import { arrivalLabel, costLine, lightsLabel, type GameCourt } from '@/lib/game-court'
import { GameFaceRow, type GameFace } from '@/components/games/GameFaceRow'
import { useHideTabBar } from '@/components/navigation/TabBarVisibility'
import { GAME_DETAIL_SELECT, normalizeGameDetail, viewerPlaysInGame } from '@/lib/public-game'
import { withReturnTo } from '@/lib/return-to'

export interface GameParticipant {
  player_id: string
  status: string
  profile: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
    account_kind?: string | null
  }
}

export interface GameDetail {
  id: string
  format: string
  scheduled_at: string
  duration_minutes: number | null
  skill_level_min: number | null
  skill_level_max: number | null
  neighborhood: string | null
  notes: string | null
  court_cost_cents: number | null
  payment: string | null
  court: GameCourt | null
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
    account_kind?: string | null
  }
  city: { name: string } | null
  participants: GameParticipant[]
}

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
}

export { viewerPlaysInGame }

export function viewerCanOpenGame(
  game: { is_open: boolean; creator_id: string; participants: { player_id: string; status: string }[] },
  viewerId: string | null,
) {
  return game.is_open || viewerPlaysInGame(game, viewerId)
}

export async function loadGameDetail(gameId: string): Promise<GameDetail | null> {
  const supabase = createClient()
  const { data } = await supabase.from('games').select(GAME_DETAIL_SELECT).eq('id', gameId).maybeSingle()
  return normalizeGameDetail(data)
}

function Fact({ children }: { children: string | null | undefined }) {
  if (!children) return null
  return <span className="px-2 py-0.5 border border-brand-divider text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.55)]">{children}</span>
}

export function GameDetailSheet({
  game,
  currentUserId,
  onClose,
  onJoined,
  onLeft,
  onCancelled,
  activeConversationId,
  viewerIsCourt,
  courtInfoOpen = false,
  mode = 'sheet',
  backHref,
}: {
  game: GameDetail
  currentUserId: string | null
  onClose?: () => void
  onJoined?: () => void
  onLeft?: () => void
  onCancelled?: () => void
  activeConversationId?: string
  viewerIsCourt?: boolean
  courtInfoOpen?: boolean
  mode?: 'sheet' | 'page'
  /** Page mode only. Where the header back arrow goes. */
  backHref?: string
}) {
  const page = mode === 'page'
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [showCancelConfirm, setShowCancelConfirm] = useState(false)
  const [joined, setJoined] = useState(false)
  const [left, setLeft] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [courtOpen, setCourtOpen] = useState(courtInfoOpen)
  const [courtViewer, setCourtViewer] = useState<boolean | null>(viewerIsCourt ?? null)
  useHideTabBar(!page)

  useEffect(() => {
    if (viewerIsCourt != null) {
      setCourtViewer(viewerIsCourt)
      return
    }
    if (!currentUserId) {
      setCourtViewer(false)
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
        if (!cancelled) setCourtViewer(data?.account_kind === 'court')
      })
    return () => { cancelled = true }
  }, [currentUserId, viewerIsCourt])

  useEffect(() => {
    let cancelled = false
    const supabase = createClient()
    void supabase
      .from('conversations')
      .select('id')
      .eq('kind', 'game')
      .eq('game_id', game.id)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled) setChatId(data?.id ?? null)
      })
    return () => { cancelled = true }
  }, [game.id])

  const accepted = game.participants.filter((participant) => holdsGameSeat(participant.status) && participant.profile.account_kind !== 'court')
  const spotsLeft = game.max_players - accepted.length
  const isFull = spotsLeft <= 0
  const isHost = Boolean(currentUserId && currentUserId === game.creator_id)
  const isCourtHost = game.creator.account_kind === 'court' && isHost
  const isPast = new Date(game.scheduled_at) < new Date()
  const isCancelled = game.status === 'cancelled'
  const alreadyIn = !isCourtHost && !left && (viewerPlaysInGame(game, currentUserId) || joined)
  const canLeave = alreadyIn && !isPast && !isCancelled && !isHost
  const canCancel = isHost && !isPast && !isCancelled
  const price = game.court?.fee === false ? 'Free' : costLine(game.court_cost_cents, game.payment)
  const placeName = game.court?.name?.trim() || game.neighborhood
  const placeDetail = game.court?.address && game.court.address !== placeName ? game.court.address : null
  const courtFacts = [
    lightsLabel(game.court?.lit),
    game.court?.fee === true && !price ? 'Fee' : null,
    arrivalLabel(game.court),
    price,
  ].filter((fact): fact is string => Boolean(fact))
  const hostFace: GameFace = {
    id: game.creator.id,
    name: game.creator.full_name,
    username: game.creator.username,
    avatarUrl: game.creator.avatar_url,
  }
  const otherFaces: GameFace[] = accepted
    .filter((participant) => participant.player_id !== game.creator.id && participant.profile.account_kind !== 'court')
    .map((participant) => ({
      id: participant.player_id,
      name: participant.profile.full_name,
      username: participant.profile.username,
      avatarUrl: participant.profile.avatar_url,
    }))
  const faces = game.creator.account_kind === 'court' ? otherFaces : [hostFace, ...otherFaces]

  const shareWhen = new Date(game.scheduled_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  const shareText = [FORMAT_LABELS[game.format] ?? game.format, shareWhen, placeName].filter(Boolean).join(' · ')

  async function handleJoin() {
    if (!game.is_open || joining || alreadyIn || isFull || isPast || isCancelled) return
    if (!currentUserId) {
      router.push(`/sign-in?next=${encodeURIComponent(`/game/${game.id}`)}`)
      return
    }
    setJoining(true)
    const res = await fetch(`/api/games/${game.id}/join`, { method: 'POST' })
    if (res.ok) {
      setLeft(false)
      setJoined(true)
      onJoined?.()
    }
    setJoining(false)
  }

  async function handleLeave() {
    if (!canLeave || leaving) return
    setLeaving(true)
    const res = await fetch(`/api/games/${game.id}/leave`, { method: 'POST' })
    if (res.ok) {
      setJoined(false)
      setLeft(true)
      onLeft?.()
    }
    setLeaving(false)
  }

  async function handleCancel() {
    if (!canCancel || cancelling) return
    setCancelling(true)
    const res = await fetch(`/api/games/${game.id}`, { method: 'DELETE' })
    setCancelling(false)
    setShowCancelConfirm(false)
    if (!res.ok) return
    onCancelled?.()
    onClose?.()
    if (page) {
      router.push(backHref ?? '/me')
      router.refresh()
    }
  }

  const joinLabel = isHost
    ? 'You organised this'
    : alreadyIn
      ? "You're in"
      : isFull
        ? 'Game is full'
        : isPast
          ? 'Game passed'
          : isCancelled
            ? 'Cancelled'
            : 'Join game'
  const joinDisabled = isHost || !game.is_open || alreadyIn || isFull || isPast || isCancelled || joining

  const shareTitle = game.is_open ? 'Open game on GAME.' : 'Private game on GAME.'
  const shareButton = (
    <ShareLinkButton path={`/game/${game.id}`} title={shareTitle} text={game.is_open ? shareText : shareTitle} size={page ? 'md' : 'sm'} />
  )
  const gamePath = backHref ? withReturnTo(`/game/${game.id}`, backHref) : `/game/${game.id}`
  const courtPageHref = game.court ? withReturnTo(`/court/${game.court.id}`, gamePath) : null
  const courtProfileHref = game.court?.profile_username
    ? withReturnTo(`/profile/${game.court.profile_username}`, gamePath)
    : null

  /** Leave sheet/search history for the durable game page, then open related. */
  function goRelated(href: string) {
    onClose?.()
    if (!page) {
      router.replace(gamePath)
      window.setTimeout(() => {
        router.push(href)
      }, 0)
      return
    }
    router.push(href)
  }

  const body = (
        <div className={page ? 'space-y-5' : 'p-5 pb-8 space-y-5'}>
          <GameFaceRow
            people={faces}
            spotsLeft={game.is_open && !isCancelled && !isPast ? spotsLeft : 0}
            onPerson={(person) => {
              if (!person.username) return
              goRelated(withReturnTo(`/profile/${person.username}`, gamePath))
            }}
          />
          {game.is_open && !isCancelled && !isPast && (
            <p className="text-[10px] tracking-[0.14em] uppercase text-[rgba(26,26,26,0.45)]">
              {isFull ? 'Full' : `${spotsLeft} spot${spotsLeft !== 1 ? 's' : ''} left`}
            </p>
          )}

          <div>
            <p className="font-display text-3xl tracking-wide leading-none text-[#1a1a1a]">
              <LocalGameDay iso={game.scheduled_at} /> <LocalGameMonth iso={game.scheduled_at} />
            </p>
            <p className="font-display text-xl tracking-wide text-brand-primary mt-1">
              <LocalGameTimeRange iso={game.scheduled_at} durationMinutes={game.duration_minutes} />
              <span className="text-[rgba(26,26,26,0.45)]"> · {FORMAT_LABELS[game.format] ?? game.format}</span>
            </p>
            {placeName && game.court && (
              <div className="mt-3 w-full rounded-[16px] bg-[#F4F1EC] px-3 py-3">
                <button
                  type="button"
                  onClick={() => setCourtOpen((open) => !open)}
                  aria-expanded={courtOpen}
                  className="w-full text-left"
                >
                  <span className="flex items-start justify-between gap-3">
                    <span className="min-w-0">
                      <span className="block font-display text-2xl leading-none tracking-wide uppercase text-[#1a1a1a]">{placeName}</span>
                      {placeDetail && (
                        <span className="mt-1 flex items-center gap-1 text-[12px] text-[rgba(26,26,26,0.5)]">
                          <MapPin size={11} />{placeDetail}
                        </span>
                      )}
                    </span>
                    <ChevronDown size={16} className={`mt-1 flex-shrink-0 text-[#3A8A7A] transition-transform ${courtOpen ? 'rotate-180' : ''}`} />
                  </span>
                  <span className="mt-2 block text-[10px] tracking-[0.14em] uppercase text-[#3A8A7A]">
                    {courtOpen ? 'Hide court info' : 'Court info'}
                  </span>
                </button>

                {courtFacts.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-1.5">
                    {courtFacts.map((fact) => (
                      <Fact key={fact}>{fact}</Fact>
                    ))}
                  </div>
                )}

                {courtOpen && (
                  <div className="mt-3 space-y-2">
                    {game.court.phone && (
                      <a href={`tel:${game.court.phone}`} className="flex items-center gap-2 text-[12px] text-[#1a1a1a]">
                        <Phone size={12} /> {game.court.phone}
                      </a>
                    )}
                    {game.court.website && (
                      <a href={game.court.website.startsWith('http') ? game.court.website : `https://${game.court.website}`} target="_blank" rel="noopener noreferrer" className="flex items-center gap-2 text-[12px] text-[#1a1a1a]">
                        <Globe size={12} /> Website
                      </a>
                    )}
                    <div className="flex flex-wrap gap-2">
                      <a
                        href={game.court.google_maps_uri ?? `https://www.google.com/maps/search/${encodeURIComponent(game.court.name)}/@${game.court.lat ?? ''},${game.court.lng ?? ''},17z`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-full bg-[#E8748A] px-4 py-2 text-[10px] tracking-[0.16em] uppercase font-medium text-[#1a1a1a]"
                      >
                        <MapPin size={12} /> View on Google Maps
                      </a>
                      {courtPageHref && (
                        <Link
                          href={courtPageHref}
                          onClick={(event) => {
                            if (page) return
                            event.preventDefault()
                            goRelated(courtPageHref)
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-[#1a1a1a]/20 bg-white px-4 py-2 text-[10px] tracking-[0.16em] uppercase font-medium text-[#1a1a1a] hover:bg-brand-field transition-colors"
                        >
                          Court page
                        </Link>
                      )}
                      {courtProfileHref && (
                        <Link
                          href={courtProfileHref}
                          onClick={(event) => {
                            if (page) return
                            event.preventDefault()
                            goRelated(courtProfileHref)
                          }}
                          className="inline-flex items-center gap-2 rounded-full border border-[#1a1a1a]/20 bg-white px-4 py-2 text-[10px] tracking-[0.16em] uppercase font-medium text-[#1a1a1a] hover:bg-brand-field transition-colors"
                        >
                          Court profile
                        </Link>
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}
            {placeName && !game.court && (
              <div className="mt-3 text-left">
                <p className="font-display text-2xl leading-none tracking-wide uppercase text-[#1a1a1a]">{placeName}</p>
                {placeDetail && (
                  <p className="mt-1 text-[12px] text-[rgba(26,26,26,0.5)] flex items-center gap-1">
                    <MapPin size={11} />{placeDetail}
                  </p>
                )}
                {(price || isCancelled) && (
                  <div className="mt-2 flex flex-wrap gap-1.5">
                    {price && <Fact>{price}</Fact>}
                    {isCancelled && <Fact>Cancelled</Fact>}
                  </div>
                )}
              </div>
            )}
            {game.court && isCancelled && (
              <div className="mt-2 flex flex-wrap gap-1.5">
                <Fact>Cancelled</Fact>
              </div>
            )}
            {game.notes && (
              <p className="font-copy mt-3 text-sm text-[rgba(26,26,26,0.55)]">{game.notes}</p>
            )}
          </div>

          {chatId && chatId !== activeConversationId && (
            <Link
              href={`/chats/${chatId}`}
              onClick={() => onClose?.()}
              className="block w-full py-3 rounded-full text-center text-[10px] tracking-[0.2em] uppercase font-medium border border-[#1a1a1a]/20 text-[#1a1a1a] hover:border-[#1a1a1a]/50 transition-colors"
            >
              Game chat
            </Link>
          )}

          {canCancel && (
            <button
              type="button"
              onClick={() => setShowCancelConfirm(true)}
              className="w-full py-4 rounded-full border border-red-200 text-[10px] tracking-[0.2em] uppercase font-medium text-red-500 transition-colors hover:bg-red-50"
            >
              Cancel game
            </button>
          )}

          {!isHost && courtViewer === false && canLeave && (
            <button
              type="button"
              onClick={handleLeave}
              disabled={leaving}
              className="w-full py-4 rounded-full border border-[#1a1a1a]/20 text-[10px] tracking-[0.2em] uppercase font-medium text-[#1a1a1a] transition-colors hover:border-[#1a1a1a]/50 disabled:opacity-50"
            >
              {leaving ? <Loader2 size={14} className="animate-spin mx-auto" /> : 'Leave game'}
            </button>
          )}

          {!isHost && courtViewer === false && !canLeave && (
            <button
              type="button"
              onClick={handleJoin}
              disabled={joinDisabled}
              className={`w-full py-4 rounded-full text-[10px] tracking-[0.2em] uppercase font-medium transition-colors ${
                joinDisabled
                  ? 'bg-brand-surface text-[rgba(26,26,26,0.35)] cursor-default'
                  : 'bg-[#3A8A7A] text-white hover:bg-[#2F7366]'
              }`}
            >
              {joining ? <Loader2 size={14} className="animate-spin mx-auto" /> : joinLabel}
            </button>
          )}

          {isHost && !canCancel && (
            <button
              type="button"
              disabled
              className="w-full py-4 rounded-full bg-brand-surface text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.35)] cursor-default"
            >
              {joinLabel}
            </button>
          )}
        </div>
  )

  const cancelConfirm = showCancelConfirm ? (
    <div className="fixed inset-0 z-[80] flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
      <div className="bg-white rounded-[28px] max-w-sm w-full p-6">
        <span className="font-display text-2xl tracking-wide block mb-3">CANCEL GAME?</span>
        <p className="text-sm text-[rgba(26,26,26,0.5)] mb-5">
          {accepted.length > 0
            ? 'Players who joined will be notified in chat that this game is fully cancelled.'
            : 'This game will be removed from your schedule.'}
        </p>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={() => setShowCancelConfirm(false)}
            disabled={cancelling}
            className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-sm font-medium text-[#1a1a1a] hover:bg-white transition-colors"
          >
            Keep
          </button>
          <button
            type="button"
            onClick={() => { void handleCancel() }}
            disabled={cancelling}
            className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors"
          >
            {cancelling ? 'Cancelling…' : 'Cancel game'}
          </button>
        </div>
      </div>
    </div>
  ) : null

  if (page) {
    return (
      <div className="min-h-screen pb-20 md:pb-0">
        <div className="page-header">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <Link href={backHref ?? '/search'} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors" aria-label="Back">
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
            </Link>
            <span className="flex-1 font-display text-2xl tracking-wide text-[#1a1a1a]">
              {game.is_open ? 'OPEN GAME' : 'GAME'}
            </span>
            {shareButton}
          </div>
        </div>
        <div className="max-w-2xl mx-auto px-4 py-4">
          <div className="rounded-[28px] bg-white p-5">{body}</div>
        </div>
        {cancelConfirm}
      </div>
    )
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[28px] max-h-[85vh] overflow-y-auto md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:rounded-[28px] md:shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-divider">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium">
            {game.is_open ? 'Open Game' : 'Game'}
          </span>
          <div className="flex items-center gap-1">
            {shareButton}
            <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]">
              <X size={16} />
            </button>
          </div>
        </div>
        {body}
      </div>
      {cancelConfirm}
    </>
  )
}
