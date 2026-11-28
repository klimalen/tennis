import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/user'
import { FeedTabs } from './FeedTabs'
import { showGamePost } from '@/lib/game-visibility'
import { attachRecapPlayers, HIDE_PRIVATE_RECAPS, mapPostRow, markRecapAccess, POST_FEED_SELECT, shownInFeed, type PostItem } from '@/lib/post-feed'
import { NOTIFICATION_PAGE_SIZE, pageFromRows, type NotificationRow } from './notifications'

// ─── Data fetching ────────────────────────────────────────────────────────────

async function FeedContent({ initialTab }: { initialTab: 'activity' | 'notifications' }) {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null

  // Fetch following IDs for posts feed
  const [{ data: followingRows }, { data: followerRows }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', user.id),
    supabase.from('follows').select('follower_id').eq('following_id', user.id),
  ])
  const followingIds = (followingRows ?? []).map((r) => r.following_id as string)
  const followersBack = new Set((followerRows ?? []).map((r) => r.follower_id as string))
  const mutualIds = new Set(followingIds.filter((id) => followersBack.has(id)))

  const [postsResult, notesResult] = await Promise.all([
    // Posts feed (own + following)
    (async () => {
      let query = supabase
        .from('posts')
        .select(POST_FEED_SELECT)
        .order('created_at', { ascending: false })
        .limit(30)

      if (followingIds.length > 0) {
        query = query.in('author_id', [user.id, ...followingIds]).or(HIDE_PRIVATE_RECAPS)
      } else {
        query = query.eq('author_id', user.id).or(HIDE_PRIVATE_RECAPS)
      }

      return query
    })(),

    supabase.rpc('list_notifications', {
      p_before: null,
      p_before_id: null,
      p_limit: NOTIFICATION_PAGE_SIZE + 1,
    }),
  ])

  const postRows = (postsResult.data ?? []) as unknown as Parameters<typeof mapPostRow>[0][]
  if (notesResult.error) console.error('[feed] notifications', notesResult.error.message)
  const { items: notifications, nextCursor } = pageFromRows(
    (notesResult.error ? [] : notesResult.data ?? []) as NotificationRow[],
  )

  // Check which posts the current user has liked
  const postIds = postRows.map((p) => p.id)
  const { data: myLikes } = postIds.length > 0
    ? await supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
    : { data: [] }
  const likedSet = new Set((myLikes ?? []).map((l) => l.post_id as string))

  const rawPosts: PostItem[] = postRows
    .map((row) => mapPostRow(row, likedSet.has(row.id)))
    .filter(shownInFeed)

  // Deduplicate open_game posts: one per game_id, prefer creator's post
  const openGameMap = new Map<string, PostItem>()
  const nonGamePosts: PostItem[] = []
  for (const post of rawPosts) {
    if (post.type === 'open_game' && !showGamePost(post.game)) continue
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
  const posts = await attachRecapPlayers(
    supabase,
    markRecapAccess(
      [...nonGamePosts, ...openGameMap.values()].sort((a, b) => b.created_at.localeCompare(a.created_at)),
      user.id,
      mutualIds,
    ),
  )

  const latestNotificationAt = notifications[0]?.createdAt ?? null

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="page-header">
        <div className="mx-auto flex max-w-2xl items-end">
          <span className="font-display text-4xl tracking-wide leading-none">FEED</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        <FeedTabs
          userId={user.id}
          initialPosts={posts}
          initialNotifications={notifications}
          initialNotificationCursor={nextCursor}
          latestNotificationAt={latestNotificationAt}
          initialTab={initialTab}
        />
      </div>
    </div>
  )
}

export default async function FeedPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string | string[] }>
}) {
  const { tab } = await searchParams
  const initialTab = tab === 'notifications' ? 'notifications' : 'activity'
  return (
    <AuthGate section="feed">
      <FeedContent initialTab={initialTab} />
    </AuthGate>
  )
}
