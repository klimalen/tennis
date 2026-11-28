import { gameEndMs } from '@/lib/game-time'
import { holdsGameSeat } from '@/lib/schedule'
import type { RecapVisibility } from '@tennis/shared'

export type { RecapVisibility }

export const RECAP_VISIBILITIES = ['private', 'friends', 'public'] as const

export const RECAP_PHOTO_MAX = 6

export interface RecapPlayer {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

export function parseRecapVisibility(value: unknown, fallback: RecapVisibility = 'friends'): RecapVisibility | null {
  if (value == null || value === '') return fallback
  return (RECAP_VISIBILITIES as readonly string[]).includes(value as string) ? value as RecapVisibility : null
}

/** First names, joined the way the recap card reads them. */
export function recapPlayerNames(players: { full_name: string }[]): string {
  const names = players
    .map((player) => player.full_name.trim().split(/\s+/)[0] ?? '')
    .filter(Boolean)
  if (names.length === 0) return 'Players'
  if (names.length === 1) return names[0]!
  if (names.length === 2) return `${names[0]} & ${names[1]}`
  if (names.length === 3) return `${names[0]}, ${names[1]} & ${names[2]}`
  return `${names[0]}, ${names[1]} & ${names.length - 2} more`
}

export function gameAccess(game: { is_open: boolean; visibility?: string | null }): 'private' | 'friends' | 'open' {
  if (game.visibility === 'private' || game.visibility === 'friends' || game.visibility === 'open') return game.visibility
  return game.is_open ? 'open' : 'private'
}

export function recapAudienceNotice(
  gameVisibility: 'private' | 'friends' | 'open',
  visibility: RecapVisibility,
): string | null {
  if (visibility === 'private') return 'Only you can see this recap. It stays off the feed.'
  if (gameVisibility === 'private') {
    if (visibility === 'public') {
      return 'Your game stays private. Only the game date and players will be shared with everyone, along with your recap.'
    }
    return 'Your game stays private. Only the game date and players will be shared along with your recap.'
  }
  if (gameVisibility === 'friends') {
    return 'Your game stays with mutual friends. Anyone who can\'t open it only sees the date and the players with your recap.'
  }
  const who = visibility === 'public' ? 'everyone' : 'mutual friends'
  return `The game date and players will be visible to ${who}, along with your recap.`
}

/** Past, not cancelled, and the viewer organised it or still holds a seat. */
export function viewerCanWriteRecap(
  game: {
    status: string
    scheduled_at: string
    duration_minutes: number | null
    creator_id: string
    participants?: { player_id: string; status: string }[]
  },
  viewerId: string | null,
  now = Date.now(),
): boolean {
  if (!viewerId) return false
  if (game.status === 'cancelled' || game.status === 'draft') return false
  if (gameEndMs(game.scheduled_at, game.duration_minutes) > now) return false
  if (game.creator_id === viewerId) return true
  return (game.participants ?? []).some(
    (participant) => participant.player_id === viewerId && holdsGameSeat(participant.status),
  )
}

/** Open games are readable by anyone. A private game opens only for people who played. */
export function viewerCanOpenRecapGame(
  game: { is_open: boolean; visibility?: string | null; creator_id: string } | null,
  playerIds: string[],
  viewerId: string | null,
  mutualWithCreator = false,
): boolean {
  if (!game) return false
  if (viewerId && (game.creator_id === viewerId || playerIds.includes(viewerId))) return true
  const access = gameAccess(game)
  if (access === 'open') return true
  if (access === 'friends') return mutualWithCreator
  return false
}
