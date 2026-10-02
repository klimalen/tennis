import { holdsGameSeat } from '@/lib/schedule'

export interface RankedOpenGame {
  id: string
  scheduled_at: string
  max_players: number
  creator_id: string
  distance_km?: number | null
  participants: { player_id: string; status: string; profile: { account_kind?: string | null } }[]
}

export function openGameSpotsLeft(game: Pick<RankedOpenGame, 'max_players' | 'participants'>) {
  const taken = game.participants.filter((participant) => holdsGameSeat(participant.status) && participant.profile.account_kind !== 'court').length
  return game.max_players - taken
}

/** Creator or anyone holding a seat. A court host counts as already in their own game. */
export function userIsInOpenGame(game: RankedOpenGame, userId: string | null, extraJoinedIds?: ReadonlySet<string>) {
  if (extraJoinedIds?.has(game.id)) return true
  if (!userId) return false
  if (game.creator_id === userId) return true
  return game.participants.some((participant) => participant.player_id === userId && holdsGameSeat(participant.status))
}

/** 0 when the viewer can still take a seat. Those games sort first. */
export function openGameJoinRank(game: RankedOpenGame, userId: string | null, extraJoinedIds?: ReadonlySet<string>) {
  const canJoin = openGameSpotsLeft(game) > 0 && !userIsInOpenGame(game, userId, extraJoinedIds)
  return canJoin ? 0 : 1
}

export function compareOpenGames<T extends RankedOpenGame>(userId: string | null, extraJoinedIds?: ReadonlySet<string>) {
  return (a: T, b: T) => {
    const rank = openGameJoinRank(a, userId, extraJoinedIds) - openGameJoinRank(b, userId, extraJoinedIds)
    if (rank !== 0) return rank
    const distA = a.distance_km ?? Number.POSITIVE_INFINITY
    const distB = b.distance_km ?? Number.POSITIVE_INFINITY
    if (distA !== distB) return distA - distB
    return Date.parse(a.scheduled_at) - Date.parse(b.scheduled_at)
  }
}

/** Local calendar day, so the chip matches the date printed on the card. */
export function localGameDayKey(iso: string) {
  const dt = new Date(iso)
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

export function openGameDayLabel(iso: string, now = new Date()) {
  const dt = new Date(iso)
  const start = new Date(dt.getFullYear(), dt.getMonth(), dt.getDate())
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  const diff = Math.round((start.getTime() - today.getTime()) / 86_400_000)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  return dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric' })
}

export function openGameDayHeading(iso: string) {
  return new Date(iso).toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'short' })
}
