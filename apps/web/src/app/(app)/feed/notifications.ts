export const NOTIFICATION_PAGE_SIZE = 10

export type NotificationKind =
  | 'follow'
  | 'request'
  | 'request_accepted'
  | 'request_declined'
  | 'game_invite'
  | 'game_updated'
  | 'game_cancelled'
  | 'game_joined'
  | 'game_left'

export interface NotificationActor {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
  city_name: string | null
}

export interface NotificationPayload {
  request_id?: string
  scheduled_at?: string
  format?: string
  location?: string | null
}

export interface NotificationItem {
  id: string
  kind: NotificationKind
  gameId: string | null
  payload: NotificationPayload
  createdAt: string
  followingBack: boolean
  actor: NotificationActor | null
}

export interface NotificationCursor {
  at: string
  id: string
}

export interface NotificationRow {
  id: string
  kind: string
  game_id: string | null
  payload: NotificationPayload | null
  created_at: string
  actor_id: string | null
  actor_full_name: string | null
  actor_username: string | null
  actor_avatar_url: string | null
  actor_skill_self: number | string | null
  actor_skill_computed: number | string | null
  actor_city: string | null
  following_back: boolean | null
}

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === '') return null
  const parsed = typeof value === 'number' ? value : Number(value)
  return Number.isFinite(parsed) ? parsed : null
}

export function mapNotification(row: NotificationRow): NotificationItem {
  const actor = row.actor_id && row.actor_username
    ? {
        id: row.actor_id,
        full_name: row.actor_full_name || 'Player',
        username: row.actor_username,
        avatar_url: row.actor_avatar_url,
        skill_level_self: num(row.actor_skill_self),
        skill_level_computed: num(row.actor_skill_computed),
        city_name: row.actor_city,
      }
    : null

  return {
    id: row.id,
    kind: row.kind as NotificationKind,
    gameId: row.game_id,
    payload: row.payload ?? {},
    createdAt: row.created_at,
    followingBack: Boolean(row.following_back),
    actor,
  }
}

export function pageFromRows(rows: NotificationRow[]): {
  items: NotificationItem[]
  nextCursor: NotificationCursor | null
} {
  const hasMore = rows.length > NOTIFICATION_PAGE_SIZE
  const items = rows.slice(0, NOTIFICATION_PAGE_SIZE).map(mapNotification)
  const last = items.at(-1)
  return {
    items,
    nextCursor: hasMore && last ? { at: last.createdAt, id: last.id } : null,
  }
}
