import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { FeedTabs } from './FeedTabs'
import { type RequestItem, type FollowItem } from './FeedClient'
import type { PostItem } from './PostCard'

// ─── Types ────────────────────────────────────────────────────────────────────

interface RequestRow {
  id: string
  created_at: string
  sender: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
    city_name: string | null
  }
}

interface FollowRow {
  created_at: string
  follower: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
    skill_level_self: number | null
    skill_level_computed: number | null
    city_name: string | null
  }
}

interface PostRow {
  id: string
  type: string
  body: string | null
  image_url: string | null
  created_at: string
  updated_at: string
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
    city: { name: string } | null
  } | null
  likes: [{ count: number }] | []
}

// ─── Data fetching ────────────────────────────────────────────────────────────

async function FeedContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  // Fetch following IDs for posts feed
  const { data: followingRows } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
  const followingIds = (followingRows ?? []).map((r) => r.following_id as string)

  // Fetch all three data sources in parallel
  const [postsResult, requestsResult, followsResult] = await Promise.all([
    // Posts feed (own + following)
    (async () => {
      let query = supabase
        .from('posts')
        .select(`
          id, type, body, image_url, created_at, updated_at,
          author:profiles!author_id (id, full_name, username, avatar_url),
          match_result:match_results (
            id, winner_id, winning_team, played_at,
            winner:profiles!winner_id (full_name, username),
            game:games (format, scheduled_at)
          ),
          game:games (
            id, creator_id, format, scheduled_at, skill_level_min, skill_level_max,
            neighborhood, status, max_players, is_open,
            city:cities (name)
          ),
          likes:post_likes (count)
        `)
        .order('created_at', { ascending: false })
        .limit(30)

      if (followingIds.length > 0) {
        query = query.or(`author_id.eq.${user.id},author_id.in.(${followingIds.join(',')})`)
      } else {
        query = query.eq('author_id', user.id)
      }

      return query
    })(),

    // Game requests (activity tab)
    supabase
      .from('game_requests')
      .select(`id, created_at, sender:sender_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name)`)
      .eq('receiver_id', user.id)
      .eq('status', 'pending')
      .order('created_at', { ascending: false }),

    // Follows (activity tab)
    supabase
      .from('follows')
      .select(`created_at, follower:follower_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed, city_name)`)
      .eq('following_id', user.id)
      .order('created_at', { ascending: false })
      .limit(50),
  ])

  const postRows = (postsResult.data ?? []) as unknown as PostRow[]
  const requestRows = (requestsResult.data ?? []) as unknown as RequestRow[]
  const followRows = (followsResult.data ?? []) as unknown as FollowRow[]

  // Check which followers the current user follows back
  const followerIds = followRows.map((f) => f.follower.id)
  const { data: alreadyFollowing } = followerIds.length > 0
    ? await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', user.id)
        .in('following_id', followerIds)
    : { data: [] }
  const followingSet = new Set((alreadyFollowing ?? []).map((r) => r.following_id as string))

  // Check which posts the current user has liked
  const postIds = postRows.map((p) => p.id)
  const { data: myLikes } = postIds.length > 0
    ? await supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
    : { data: [] }
  const likedSet = new Set((myLikes ?? []).map((l) => l.post_id as string))

  // Transform posts
  const rawPosts: PostItem[] = postRows.map((row) => ({
    id: row.id,
    type: row.type as PostItem['type'],
    body: row.body,
    image_url: row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    author: row.author as PostItem['author'],
    match_result: row.match_result as PostItem['match_result'],
    game: row.game as PostItem['game'],
    likes_count: row.likes[0]?.count ?? 0,
    liked_by_me: likedSet.has(row.id),
  }))

  // Deduplicate open_game posts: one per game_id, prefer creator's post
  const openGameMap = new Map<string, PostItem>()
  const nonGamePosts: PostItem[] = []
  for (const post of rawPosts) {
    if (post.type !== 'open_game' || !post.game?.id) {
      nonGamePosts.push(post)
      continue
    }
    const gameId = post.game.id
    const existing = openGameMap.get(gameId)
    if (!existing) {
      openGameMap.set(gameId, post)
    } else {
      // Prefer the creator's post over a participant's post
      const isCreator = post.game.creator_id === post.author.id
      const existingIsCreator = existing.game?.creator_id === existing.author.id
      if (isCreator && !existingIsCreator) openGameMap.set(gameId, post)
    }
  }
  const posts: PostItem[] = [...nonGamePosts, ...openGameMap.values()]
    .sort((a, b) => b.created_at.localeCompare(a.created_at))

  // Transform activity
  const followItems: FollowItem[] = followRows.map((f) => ({
    followerId: f.follower.id,
    created_at: f.created_at,
    isFollowingBack: followingSet.has(f.follower.id),
    follower: f.follower,
  }))

  // Latest timestamp across all notification items for badge logic
  const allTimestamps = [
    ...requestRows.map((r) => r.created_at),
    ...followRows.map((f) => f.created_at),
  ]
  const latestNotificationAt = allTimestamps.length > 0
    ? allTimestamps.reduce((a, b) => (a > b ? a : b))
    : null

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <span className="font-display text-3xl tracking-wide">FEED</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <FeedTabs
          userId={user.id}
          initialPosts={posts}
          initialRequests={requestRows as RequestItem[]}
          initialFollows={followItems}
          latestNotificationAt={latestNotificationAt}
        />
      </div>
    </div>
  )
}

export default async function FeedPage() {
  return (
    <AuthGate section="feed">
      <FeedContent />
    </AuthGate>
  )
}
