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

/** Local calendar day, so a picked range matches the date printed on the card. */
export function localGameDayKey(iso: string) {
  const dt = new Date(iso)
  const month = String(dt.getMonth() + 1).padStart(2, '0')
  const day = String(dt.getDate()).padStart(2, '0')
  return `${dt.getFullYear()}-${month}-${day}`
}

export function gameInDayRange(iso: string, range: { start: string; end: string } | null) {
  if (!range) return true
  const key = localGameDayKey(iso)
  const start = range.start <= range.end ? range.start : range.end
  const end = range.start <= range.end ? range.end : range.start
  return key >= start && key <= end
}
