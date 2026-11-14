export const PUSH_TITLES: Record<string, string> = {
  follow: 'New follower',
  request: 'Wants to play',
  request_accepted: 'Request accepted',
  request_declined: 'Request declined',
  game_invite: 'Game invite',
  game_joined: 'Player joined',
  game_left: 'Player left',
  game_updated: 'Game updated',
  game_cancelled: 'Game cancelled',
  message: 'New message',
}

export function pushPathFor(kind: string, gameId: string | null, payload: Record<string, unknown> | null): string {
  if (kind === 'message' && typeof payload?.['conversation_id'] === 'string') {
    return `/chats/${payload['conversation_id']}`
  }
  if (gameId) return `/games/${gameId}`
  return '/feed'
}

export function pushBodyFor(
  kind: string,
  actorName: string,
  payload: Record<string, unknown> | null,
): string {
  const name = actorName || 'Someone'
  switch (kind) {
    case 'follow':
      return `${name} started following you`
    case 'request':
      return `${name} wants to play`
    case 'request_accepted':
      return `${name} accepted your request`
    case 'request_declined':
      return `${name} declined your request`
    case 'game_invite':
      return `${name} invited you to a game`
    case 'game_joined':
      return `${name} joined your game`
    case 'game_left':
      return `${name} left your game`
    case 'game_updated':
      return `${name} updated a game`
    case 'game_cancelled':
      return `${name} cancelled a game`
    case 'message': {
      const preview = typeof payload?.['preview'] === 'string' ? payload['preview'].trim() : ''
      return preview || `${name} sent you a message`
    }
    default:
      return `${name} sent an update`
  }
}
