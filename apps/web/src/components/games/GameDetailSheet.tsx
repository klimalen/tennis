'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Globe, Loader2, MapPin, Phone, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LocalGameDay, LocalGameMonth, LocalGameTimeRange } from '@/components/ui/LocalGameTime'
import { holdsGameSeat } from '@/lib/schedule'
import { arrivalLabel, costLine, lightsLabel, type GameCourt } from '@/lib/game-court'
import { GameFaceRow, type GameFace } from '@/components/games/GameFaceRow'
import { useHideTabBar } from '@/components/navigation/TabBarVisibility'

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

const DETAIL_SELECT = `
  id, format, scheduled_at, duration_minutes, skill_level_min, skill_level_max,
  neighborhood, notes, court_cost_cents, payment, status, max_players, is_open, creator_id,
  court:venue_groups!games_venue_group_id_fkey ( id, name, address, lit, fee, access, phone, website, google_maps_uri, lat, lng ),
  creator:profiles!creator_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed, account_kind),
  city:cities (name),
  participants:game_participants (
    player_id, status,
    profile:profiles!player_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed)
  )
`

export function viewerPlaysInGame(
  game: {
    creator_id: string
    participants: { player_id: string; status: string }[]
    creator?: { account_kind?: string | null }
  },
  viewerId: string | null,
) {
  if (!viewerId) return false
  const courtHost = game.creator?.account_kind === 'court'
  if (game.creator_id === viewerId && !courtHost) return true
  return game.participants.some((participant) => participant.player_id === viewerId && holdsGameSeat(participant.status))
}

export function viewerCanOpenGame(
  game: { is_open: boolean; creator_id: string; participants: { player_id: string; status: string }[] },
  viewerId: string | null,
) {
  return game.is_open || viewerPlaysInGame(game, viewerId)
}

export async function loadGameDetail(gameId: string): Promise<GameDetail | null> {
  const supabase = createClient()
  const { data } = await supabase.from('games').select(DETAIL_SELECT).eq('id', gameId).maybeSingle()
  if (!data) return null
  const row = data as unknown as GameDetail & { court: GameCourt | GameCourt[] | null }
  const court = Array.isArray(row.court) ? row.court[0] ?? null : row.court
  return { ...row, court: court?.id ? court : null }
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
  activeConversationId,
  viewerIsCourt,
}: {
  game: GameDetail
  currentUserId: string | null
  onClose: () => void
  onJoined?: () => void
  activeConversationId?: string
  viewerIsCourt?: boolean
}) {
  const router = useRouter()
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  const [chatId, setChatId] = useState<string | null>(null)
  const [courtOpen, setCourtOpen] = useState(false)
  const [courtViewer, setCourtViewer] = useState<boolean | null>(viewerIsCourt ?? null)
  useHideTabBar(true)

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

  const accepted = game.participants.filter((participant) => holdsGameSeat(participant.status))
  const spotsLeft = game.max_players - accepted.length
  const isFull = spotsLeft <= 0
  const isCourtHost = game.creator.account_kind === 'court' && currentUserId === game.creator_id
  const alreadyIn = !isCourtHost && (viewerPlaysInGame(game, currentUserId) || joined)
  const isPast = new Date(game.scheduled_at) < new Date()
  const isCancelled = game.status === 'cancelled'
  const price = game.court?.fee === false ? 'Free' : costLine(game.court_cost_cents, game.payment)
  const placeName = game.court?.name?.trim() || game.neighborhood
  const placeDetail = game.court?.address && game.court.address !== placeName ? game.court.address : null
  const hostFace: GameFace = {
    id: game.creator.id,
    name: game.creator.full_name,
    username: game.creator.username,
    avatarUrl: game.creator.avatar_url,
  }
  const otherFaces: GameFace[] = accepted
    .filter((participant) => participant.player_id !== game.creator.id)
    .map((participant) => ({
      id: participant.player_id,
      name: participant.profile.full_name,
      username: participant.profile.username,
      avatarUrl: participant.profile.avatar_url,
    }))
  const faces = [hostFace, ...otherFaces]

  async function handleJoin() {
    if (!game.is_open || joining || alreadyIn || isFull || isPast || isCancelled) return
    if (!currentUserId) return
    setJoining(true)
    const res = await fetch(`/api/games/${game.id}/join`, { method: 'POST' })
    if (res.ok) {
      setJoined(true)
      onJoined?.()
    }
    setJoining(false)
  }

  const joinLabel = isCourtHost ? 'You organised this' : alreadyIn ? "You're in" : isFull ? 'Game is full' : isPast ? 'Game passed' : isCancelled ? 'Cancelled' : 'Join game'
  const joinDisabled = isCourtHost || !game.is_open || alreadyIn || isFull || isPast || isCancelled || joining

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-[60]" onClick={onClose} />
      <div className="fixed bottom-0 left-0 right-0 z-[70] bg-white rounded-t-[28px] max-h-[85vh] overflow-y-auto md:max-w-lg md:left-1/2 md:-translate-x-1/2 md:bottom-8 md:rounded-[28px] md:shadow-xl">
        <div className="flex items-center justify-between px-4 py-3 border-b border-brand-divider">
          <span className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium">
            {game.is_open ? 'Open Game' : 'Game'}
          </span>
          <button onClick={onClose} className="w-7 h-7 flex items-center justify-center text-[rgba(26,26,26,0.5)] hover:text-[#1a1a1a]">
            <X size={16} />
          </button>
        </div>

        <div className="p-5 pb-8 space-y-5">
          <GameFaceRow
            people={faces}
            spotsLeft={game.is_open && !isCancelled && !isPast ? spotsLeft : 0}
            onPerson={(person) => {
              if (!person.username) return
              onClose()
              router.push(`/profile/${person.username}`)
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
            {placeName && (
              <button
                type="button"
                onClick={() => game.court && setCourtOpen((open) => !open)}
                className={`mt-3 text-left ${game.court ? 'hover:opacity-80' : 'cursor-default'}`}
              >
                <p className="font-display text-2xl leading-none tracking-wide uppercase text-[#1a1a1a]">{placeName}</p>
                {placeDetail && (
                  <p className="mt-1 text-[12px] text-[rgba(26,26,26,0.5)] flex items-center gap-1">
                    <MapPin size={11} />{placeDetail}
                  </p>
                )}
              </button>
            )}
            <div className="flex flex-wrap gap-1.5 mt-2">
              {lightsLabel(game.court?.lit) && <Fact>{lightsLabel(game.court?.lit)}</Fact>}
              {game.court?.fee === true && !price && <Fact>Fee</Fact>}
              {arrivalLabel(game.court) && <Fact>{arrivalLabel(game.court)}</Fact>}
              {price && <Fact>{price}</Fact>}
              {isCancelled && <Fact>Cancelled</Fact>}
            </div>
            {courtOpen && game.court && (
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
                <a
                  href={game.court.google_maps_uri ?? `https://www.google.com/maps/search/${encodeURIComponent(game.court.name)}/@${game.court.lat ?? ''},${game.court.lng ?? ''},17z`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-full bg-[#E8748A] px-4 py-2 text-[10px] tracking-[0.16em] uppercase text-[#1a1a1a]"
                >
                  <MapPin size={12} /> View on Google Maps
                </a>
              </div>
            )}
            {game.notes && (
              <p className="font-copy mt-3 text-sm text-[rgba(26,26,26,0.55)]">{game.notes}</p>
            )}
          </div>

          {chatId && chatId !== activeConversationId && (
            <Link
              href={`/chats/${chatId}`}
              onClick={onClose}
              className="block w-full py-3 rounded-full text-center text-[10px] tracking-[0.2em] uppercase font-medium border border-[#1a1a1a]/20 text-[#1a1a1a] hover:border-[#1a1a1a]/50 transition-colors"
            >
              Game chat
            </Link>
          )}

          {courtViewer === false && (
            <button
              onClick={handleJoin}
              disabled={joinDisabled}
              className={`w-full py-4 rounded-full text-[10px] tracking-[0.2em] uppercase font-medium transition-colors ${
                joinDisabled
                  ? 'bg-brand-surface text-[rgba(26,26,26,0.35)] cursor-default'
                  : 'bg-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]'
              }`}
            >
              {joining ? <Loader2 size={14} className="animate-spin mx-auto" /> : joinLabel}
            </button>
          )}
        </div>
      </div>
    </>
  )
}
