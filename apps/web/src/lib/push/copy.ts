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

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
const USERNAME = /^[a-z0-9_]+$/

export const NOTIFICATIONS_PATH = '/feed?tab=notifications'

const GAME_CARD_KINDS = new Set(['game_invite', 'game_joined', 'game_left', 'game_updated'])
const PROFILE_KINDS = new Set(['follow', 'request_accepted', 'request_declined'])

export function pushPathFor(
  kind: string,
  gameId: string | null,
  payload: Record<string, unknown> | null,
  actorUsername?: string | null,
): string {
  const conversationId = payload?.['conversation_id']
  if (kind === 'message' && typeof conversationId === 'string' && UUID.test(conversationId)) {
    return `/chats/${conversationId}`
  }
  if (gameId && UUID.test(gameId) && GAME_CARD_KINDS.has(kind)) {
    return `/game/${gameId}`
  }
  if (actorUsername && USERNAME.test(actorUsername) && PROFILE_KINDS.has(kind)) {
    return `/profile/${actorUsername}`
  }
  return NOTIFICATIONS_PATH
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
