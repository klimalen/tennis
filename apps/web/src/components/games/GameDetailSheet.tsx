'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { Loader2, MapPin, X } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'
import { skillLabel } from '@/lib/skill'
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

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
}

const DETAIL_SELECT = `
  id, format, scheduled_at, skill_level_min, skill_level_max,
  neighborhood, notes, status, max_players, is_open, creator_id,
  creator:profiles!creator_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed),
  city:cities (name),
  participants:game_participants (
    player_id, status,
    profile:profiles!player_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed)
  )
`

export function viewerPlaysInGame(
  game: { creator_id: string; participants: { player_id: string; status: string }[] },
  viewerId: string | null,
) {
  if (!viewerId) return false
  if (game.creator_id === viewerId) return true
  return game.participants.some((participant) => participant.player_id === viewerId && participant.status === 'accepted')
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
  return data as unknown as GameDetail
}

function initials(name: string) {
  return name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export function GameDetailSheet({
  game,
  currentUserId,
  onClose,
  onJoined,
}: {
  game: GameDetail
  currentUserId: string | null
  onClose: () => void
  onJoined?: () => void
}) {
  const [joining, setJoining] = useState(false)
  const [joined, setJoined] = useState(false)
  useHideTabBar(true)

  const accepted = game.participants.filter((participant) => participant.status === 'accepted' || participant.status === 'invited')
  const spotsTaken = accepted.length
  const spotsLeft = game.max_players - spotsTaken
  const isFull = spotsLeft <= 0
  const alreadyIn = viewerPlaysInGame(game, currentUserId) || joined
  const isPast = new Date(game.scheduled_at) < new Date()
  const isCancelled = game.status === 'cancelled'
  const creatorSkill = game.creator.skill_level_computed ?? game.creator.skill_level_self
  const min = skillLabel(game.skill_level_min)
  const max = skillLabel(game.skill_level_max)
  const range = min && max ? `${min}–${max}` : (min ?? max ?? null)

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

  const joinLabel = alreadyIn ? "You're in" : isFull ? 'Game is full' : isPast ? 'Game passed' : isCancelled ? 'Cancelled' : 'Join game'
  const joinDisabled = !game.is_open || alreadyIn || isFull || isPast || isCancelled || joining

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
              {range && (
                <span className="text-[10px] tracking-[0.12em] uppercase font-medium text-[rgba(26,26,26,0.5)]">{range}</span>
              )}
              {game.neighborhood && (
                <span className="text-[11px] text-[rgba(26,26,26,0.5)] flex items-center gap-1">
                  <MapPin size={11} />{game.neighborhood}
                </span>
              )}
              {game.is_open && !isCancelled && !isPast && (
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
              <p className="font-copy mt-2 text-sm text-[rgba(26,26,26,0.55)]">{game.notes}</p>
            )}
          </div>

          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-2">Organiser</p>
            <Link href={`/profile/${game.creator.username}`} onClick={onClose} className="flex items-center gap-3 hover:opacity-80 transition-opacity">
              <div className="w-10 h-10 rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0">
                {game.creator.avatar_url ? (
                  <Image src={game.creator.avatar_url} alt={game.creator.full_name} width={40} height={40} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-sm text-[#1a1a1a]">{initials(game.creator.full_name)}</span>
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

          {accepted.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-2">
                Players · {spotsTaken}/{game.max_players}
              </p>
              <div className="space-y-2">
                {accepted.map((participant) => {
                  const participantSkill = participant.profile.skill_level_computed ?? participant.profile.skill_level_self
                  return (
                    <Link
                      key={participant.player_id}
                      href={`/profile/${participant.profile.username}`}
                      onClick={onClose}
                      className="flex items-center gap-3 hover:opacity-80 transition-opacity"
                    >
                      <div className="w-9 h-9 rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0">
                        {participant.profile.avatar_url ? (
                          <Image src={participant.profile.avatar_url} alt={participant.profile.full_name} width={36} height={36} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-sm text-[#1a1a1a]">{initials(participant.profile.full_name)}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{participant.profile.full_name}</p>
                        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{participant.profile.username}</p>
                      </div>
                      {participantSkill != null && (
                        <span className="text-[9px] tracking-[0.1em] uppercase text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                          {skillLabel(participantSkill)}
                        </span>
                      )}
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

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
        </div>
      </div>
    </>
  )
}
