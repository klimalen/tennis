export type GameVisibility = 'private' | 'friends' | 'open'

export const VISIBILITY_OPTIONS: {
  value: GameVisibility
  title: string
  join: string
  seen: string
}[] = [
  {
    value: 'private',
    title: 'Private',
    join: 'Only the players you invite can join and see it.',
    seen: 'It shows in the schedule.',
  },
  {
    value: 'friends',
    title: 'Friends',
    join: 'Only people you follow who follow you back can see it and join.',
    seen: '',
  },
  {
    value: 'open',
    title: 'Open',
    join: 'Anyone can find this game in Search and join it.',
    seen: '',
  },
]

export function visibilityOf(game: { visibility?: string | null; is_open?: boolean } | null | undefined): GameVisibility {
  if (game?.visibility === 'private' || game?.visibility === 'friends' || game?.visibility === 'open') {
    return game.visibility
  }
  return game?.is_open ? 'open' : 'private'
}

/** Open and Friends can be joined from the game itself. Private is invite-only. */
export function gameAllowsSelfJoin(game: { visibility?: string | null; is_open?: boolean } | null | undefined) {
  const visibility = visibilityOf(game)
  return visibility === 'open' || visibility === 'friends'
}

/** A game post belongs in a feed only when the viewer is allowed to read the game, and never for Private. */
export function showGamePost(game: { visibility?: string | null; is_open?: boolean } | null | undefined) {
  return Boolean(game) && visibilityOf(game) !== 'private'
}

export function gameAccessKicker(
  game: { visibility?: string | null; is_open?: boolean },
  page: boolean,
) {
  const visibility = visibilityOf(game)
  if (visibility === 'open') return page ? 'OPEN GAME' : 'Open Game'
  if (visibility === 'friends') return page ? 'FRIENDS' : 'Friends'
  return page ? 'GAME' : 'Game'
}

export function gameShareTitle(game: { visibility?: string | null; is_open?: boolean }) {
  const visibility = visibilityOf(game)
  if (visibility === 'open') return 'Open game on GAME.'
  if (visibility === 'friends') return 'Friends game on GAME.'
  return 'Private game on GAME.'
}

export function parseVisibility(value: unknown): GameVisibility | null {
  if (value === 'private' || value === 'friends' || value === 'open') return value
  return null
}
