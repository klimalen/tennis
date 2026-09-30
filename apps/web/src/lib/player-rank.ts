export type RankablePlayer = {
  id: string
  city_name: string | null
  last_active_at: string | null
  distance_km: number | null
}

export function normalizeCity(name: string | null | undefined): string {
  return (name ?? '').trim().toLowerCase()
}

function cityGroup(player: RankablePlayer): string {
  const city = normalizeCity(player.city_name)
  return city || `player:${player.id}`
}

function activeAt(player: RankablePlayer): number {
  if (!player.last_active_at) return 0
  const parsed = Date.parse(player.last_active_at)
  return Number.isNaN(parsed) ? 0 : parsed
}

// Same written city name is one city, whatever map point was saved with it.
// Everyone stays in the list. Mutual friends are ordered after strangers, and
// both groups use the same city order: your city by last visit, then other
// cities nearest first and, inside a city, by last visit.
export function rankPlayers<T extends RankablePlayer>(
  players: T[],
  viewerCity: string | null,
  friendIds: ReadonlySet<string>,
): T[] {
  const viewer = normalizeCity(viewerCity)

  const cityDistance = new Map<string, number>()
  for (const player of players) {
    const group = cityGroup(player)
    const distance = player.distance_km ?? Number.POSITIVE_INFINITY
    const current = cityDistance.get(group)
    if (current === undefined || distance < current) cityDistance.set(group, distance)
  }

  const sameCity = (player: RankablePlayer) =>
    viewer.length > 0 && normalizeCity(player.city_name) === viewer

  return [...players].sort((a, b) => {
    const friendA = friendIds.has(a.id) ? 1 : 0
    const friendB = friendIds.has(b.id) ? 1 : 0
    if (friendA !== friendB) return friendA - friendB

    const sameA = sameCity(a) ? 0 : 1
    const sameB = sameCity(b) ? 0 : 1
    if (sameA !== sameB) return sameA - sameB

    if (sameA === 0) return activeAt(b) - activeAt(a)

    const groupA = cityGroup(a)
    const groupB = cityGroup(b)
    const distA = cityDistance.get(groupA) ?? Number.POSITIVE_INFINITY
    const distB = cityDistance.get(groupB) ?? Number.POSITIVE_INFINITY
    if (distA !== distB) return distA - distB
    if (groupA !== groupB) return groupA < groupB ? -1 : 1
    return activeAt(b) - activeAt(a)
  })
}
