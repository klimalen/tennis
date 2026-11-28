import type { SupabaseClient } from '@supabase/supabase-js'
import { viewerCanOpenRecapGame, type RecapPlayer, type RecapVisibility } from '@/lib/game-recap'

export interface PostItem {
  id: string
  type: 'manual' | 'match_result' | 'open_game' | 'game_recap'
  body: string | null
  image_url: string | null
  image_urls: string[]
  visibility: RecapVisibility
  recap_player_ids: string[]
  recap_players: RecapPlayer[]
  created_at: string
  author: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
  }
  match_result: {
    id: string
    winner_id: string | null
    winning_team: number | null
    played_at: string | null
    winner: { full_name: string; username: string } | null
    game: { format: string; scheduled_at: string } | null
  } | null
  game: {
    id: string
    creator_id: string
    format: string
    scheduled_at: string
    skill_level_min: number | null
    skill_level_max: number | null
    neighborhood: string | null
    status: string
    max_players: number
    is_open: boolean
    visibility?: 'private' | 'friends' | 'open' | null
    city: { name: string } | null
  } | null
  /** Viewer may open the game behind a recap. False for every other post. */
  can_open_game: boolean
  likes_count: number
  liked_by_me: boolean
}

/** Private recaps stay on the game. Every other post, including friends recaps, can be queried. */
export const HIDE_PRIVATE_RECAPS = 'type.neq.game_recap,visibility.neq.private'

export const POST_FEED_SELECT = `
  id, type, body, image_url, visibility, recap_player_ids, created_at, updated_at,
  author:profiles!author_id (id, full_name, username, avatar_url),
  match_result:match_results (
    id, winner_id, winning_team, played_at,
    winner:profiles!winner_id (full_name, username),
    game:games (format, scheduled_at)
  ),
  game:games (
    id, creator_id, format, scheduled_at, skill_level_min, skill_level_max,
    neighborhood, status, max_players, is_open, visibility,
    city:cities (name)
  ),
  media:post_media (url, sort_order),
  likes:post_likes (count)
`

type LooseRow = {
  id: string
  type: string
  body: string | null
  image_url: string | null
  visibility?: string | null
  recap_player_ids?: string[] | null
  created_at: string
  author: PostItem['author'] | PostItem['author'][] | null
  match_result: PostItem['match_result'] | NonNullable<PostItem['match_result']>[] | null
  game: PostItem['game'] | NonNullable<PostItem['game']>[] | null
  media?: { url: string; sort_order: number }[] | null
  likes?: { count: number }[] | null
}

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function visibilityOf(value: string | null | undefined): RecapVisibility {
  if (value === 'private' || value === 'friends' || value === 'public') return value
  return 'public'
}

export function mapPostRow(row: LooseRow, liked: boolean): PostItem {
  const type = (row.type === 'game_recap' || row.type === 'match_result' || row.type === 'open_game' || row.type === 'manual')
    ? row.type
    : 'manual'
  const media = [...(row.media ?? [])].sort((a, b) => a.sort_order - b.sort_order)
  const author = one(row.author)
  return {
    id: row.id,
    type,
    body: row.body,
    image_url: type === 'game_recap' ? null : row.image_url,
    image_urls: media.map((item) => item.url).filter(Boolean),
    visibility: visibilityOf(row.visibility),
    recap_player_ids: row.recap_player_ids ?? [],
    recap_players: [],
    created_at: row.created_at,
    author: author ?? { id: '', full_name: 'Player', username: '', avatar_url: null },
    match_result: one(row.match_result),
    game: one(row.game),
    can_open_game: false,
    likes_count: row.likes?.[0]?.count ?? 0,
    liked_by_me: liked,
  }
}

export async function mutualCreatorIds(supabase: SupabaseClient, userId: string | null): Promise<Set<string>> {
  if (!userId) return new Set()
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
  ])
  const back = new Set((incoming ?? []).map((row) => row.follower_id as string))
  const ids = new Set<string>()
  for (const row of outgoing ?? []) {
    const id = row.following_id as string
    if (back.has(id)) ids.add(id)
  }
  return ids
}

export function markRecapAccess(
  posts: PostItem[],
  viewerId: string | null,
  mutualCreatorIds: ReadonlySet<string>,
): PostItem[] {
  return posts.map((post) => {
    if (post.type !== 'game_recap') return post
    return {
      ...post,
      can_open_game: viewerCanOpenRecapGame(
        post.game,
        post.recap_player_ids,
        viewerId,
        post.game ? mutualCreatorIds.has(post.game.creator_id) : false,
      ),
    }
  })
}

export function shownInFeed(post: Pick<PostItem, 'type' | 'visibility'>): boolean {
  return post.type !== 'game_recap' || post.visibility !== 'private'
}

/** Names and avatars for recap cards. Profiles are public, so this does not open the game. */
export async function attachRecapPlayers(supabase: SupabaseClient, posts: PostItem[]): Promise<PostItem[]> {
  const ids = [...new Set(posts.flatMap((post) => post.type === 'game_recap' ? post.recap_player_ids : []))]
  if (ids.length === 0) return posts
  const { data } = await supabase
    .from('profiles')
    .select('id, full_name, username, avatar_url')
    .in('id', ids)
  const byId = new Map((data ?? []).map((profile) => [profile.id as string, profile as RecapPlayer]))
  return posts.map((post) => {
    if (post.type !== 'game_recap') return post
    return {
      ...post,
      recap_players: post.recap_player_ids.flatMap((id) => {
        const profile = byId.get(id)
        return profile ? [profile] : []
      }),
    }
  })
}
