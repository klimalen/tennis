import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { ProposeMatchButton } from './ProposeMatchButton'
import { FollowButton } from './FollowButton'
import { MessageIcon } from './MessageIcon'
import { formatFollowers } from '@/lib/formatFollowers'
import { PostCard, type PostItem } from '@/app/(app)/feed/PostCard'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}
const SKILL_NAMES: Record<number, string> = {
  1: 'Beginner', 1.5: 'Beginner', 2: 'Novice', 2.5: 'Novice',
  3: 'Intermediate', 3.5: 'Intermediate', 4: 'Advanced', 4.5: 'Advanced',
  5: 'Expert', 5.5: 'Expert', 6: 'Pro', 6.5: 'Pro', 7: 'Elite',
}

interface PostRow {
  id: string
  type: string
  body: string | null
  image_url: string | null
  created_at: string
  updated_at: string
  author: { id: string; full_name: string; username: string; avatar_url: string | null }
  match_result: {
    id: string; winner_id: string | null; winning_team: number | null; played_at: string | null
    winner: { full_name: string; username: string } | null
    game: { format: string; scheduled_at: string } | null
  } | null
  game: {
    id: string; format: string; scheduled_at: string; skill_level_min: number | null
    skill_level_max: number | null; neighborhood: string | null; status: string
    max_players: number; is_open: boolean; city: { name: string } | null
  } | null
  likes: [{ count: number }] | []
}

function skillLevel(v: number | null) {
  if (!v) return null
  const rounded = Math.round(v * 2) / 2
  return { label: SKILL_LABELS[rounded] ?? v.toFixed(1), name: SKILL_NAMES[rounded] ?? '' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()

  const { data: { user: viewer } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, username, avatar_url, bio, city_name, skill_level_self, skill_level_computed, total_matches, preferred_formats, play_style, years_playing, preferred_days, preferred_time_start, preferred_time_end',
    )
    .eq('username', username)
    .is('deleted_at', null)
    .single()

  if (!profile) notFound()

  const [{ count: wins }, { count: followerCount }] = await Promise.all([
    supabase
      .from('match_results')
      .select('*', { count: 'exact', head: true })
      .eq('winner_id', profile.id)
      .eq('status', 'confirmed'),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profile.id),
  ])

  // Check follow directions + existing conversation
  let viewerIsFollowing = false
  let profileFollowsViewer = false
  let existingConvId: string | null = null

  if (viewer && viewer.id !== profile.id) {
    const [{ data: f1 }, { data: f2 }, { data: convId }] = await Promise.all([
      supabase.from('follows').select('follower_id').eq('follower_id', viewer.id).eq('following_id', profile.id).maybeSingle(),
      supabase.from('follows').select('follower_id').eq('follower_id', profile.id).eq('following_id', viewer.id).maybeSingle(),
      supabase.rpc('shared_conversation_id', { other_user_id: profile.id }),
    ])
    viewerIsFollowing = !!f1
    profileFollowsViewer = !!f2
    existingConvId = convId ?? null
  }

  const isMutual = viewerIsFollowing && profileFollowsViewer

  // Check request status in both directions + existing conversation
  let existingRequestStatus: string | null = null
  if (viewer && viewer.id !== profile.id) {
    // Request sent by viewer
    const { data: sentReq } = await supabase
      .from('game_requests')
      .select('status')
      .eq('sender_id', viewer.id)
      .eq('receiver_id', profile.id)
      .maybeSingle()

    if (sentReq) {
      existingRequestStatus = sentReq.status
    } else {
      // Request received from profile person (viewer accepted their request)
      const { data: receivedReq } = await supabase
        .from('game_requests')
        .select('status')
        .eq('sender_id', profile.id)
        .eq('receiver_id', viewer.id)
        .in('status', ['accepted', 'matched'])
        .maybeSingle()
      if (receivedReq) existingRequestStatus = receivedReq.status
    }

    // Final check: if there's already a conversation between them, always show matched
    if (!existingRequestStatus || existingRequestStatus === 'pending') {
      const { data: profileConvs } = await supabase
        .from('conversation_participants')
        .select('conversation_id')
        .eq('user_id', profile.id)
      const profileConvIds = (profileConvs ?? []).map((r) => r.conversation_id as string)
      if (profileConvIds.length > 0) {
        const { data: convParticipant } = await supabase
          .from('conversation_participants')
          .select('conversation_id')
          .eq('user_id', viewer.id)
          .in('conversation_id', profileConvIds)
          .maybeSingle()
        if (convParticipant) existingRequestStatus = 'matched'
      }
    }
  }

  const rating = profile.skill_level_computed ?? profile.skill_level_self
  const skill = skillLevel(rating)
  const totalWins = wins ?? 0
  const initials = profile.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  // Fetch user's posts
  const { data: postRows } = await supabase
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
        id, format, scheduled_at, skill_level_min, skill_level_max,
        neighborhood, status, max_players, is_open,
        city:cities (name)
      ),
      likes:post_likes (count)
    `)
    .eq('author_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const rows = (postRows ?? []) as unknown as PostRow[]
  const postIds = rows.map((p) => p.id)
  const { data: myLikes } = viewer && postIds.length > 0
    ? await supabase.from('post_likes').select('post_id').eq('user_id', viewer.id).in('post_id', postIds)
    : { data: [] }
  const likedSet = new Set((myLikes ?? []).map((l) => l.post_id as string))

  const posts: PostItem[] = rows.map((row) => ({
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

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/search" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">
            {profile.full_name.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="px-4 pt-6 pb-5">
          <div className="flex items-start gap-5">
            {/* Avatar + followers */}
            <div className="flex flex-col items-center gap-1.5 flex-shrink-0">
              <div className="w-20 h-20 bg-brand-surface flex items-center justify-center border border-brand-divider overflow-hidden">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.full_name} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-3xl text-[rgba(26,26,26,0.3)]">{initials}</span>
                )}
              </div>
              <div className="flex flex-col items-center">
                <span className="font-numbers text-sm leading-none text-brand-primary">{formatFollowers(followerCount ?? 0)}</span>
                <span className="text-[8px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">followers</span>
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around pt-1">
              {[
                { value: String(profile.total_matches), label: 'Matches' },
                { value: String(totalWins), label: 'Wins' },
                { value: rating ? String(rating) : '—', label: 'Rating' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-0.5">
                  <span className="font-numbers text-3xl leading-none text-brand-primary">{stat.value}</span>
                  <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Name + meta */}
          <div className="mt-4 space-y-1.5">
            <p className="font-display text-2xl tracking-wide leading-none">{profile.full_name.toUpperCase()}</p>
            <p className="text-[11px] tracking-[0.15em] text-[rgba(26,26,26,0.4)]">@{profile.username}</p>

            {profile.city_name && (
              <p className="flex items-center gap-1 text-[11px] text-[rgba(26,26,26,0.45)]">
                <MapPin size={11} />
                {profile.city_name}
              </p>
            )}

            {skill && (
              <div className="pt-0.5">
                <span className="text-[9px] tracking-[0.15em] uppercase text-brand-primary font-medium border border-brand-primary px-2 py-0.5">
                  {skill.label} — {skill.name}
                </span>
              </div>
            )}

            {profile.bio && (
              <p className="text-sm text-[rgba(26,26,26,0.6)] font-script italic pt-1">{profile.bio}</p>
            )}
          </div>

          {/* Actions — only shown to other logged-in users */}
          {viewer && viewer.id !== profile.id && (
            <div className="flex items-end gap-2 mt-4">
              <div className="flex-1">
                <ProposeMatchButton
                  receiverId={profile.id}
                  receiverName={profile.full_name}
                  existingStatus={existingRequestStatus}
                />
              </div>
              <FollowButton
                followingId={profile.id}
                initialFollowing={viewerIsFollowing}
              />
              {isMutual && (
                <MessageIcon otherUserId={profile.id} existingConvId={existingConvId} />
              )}
            </div>
          )}
        </div>

        {/* Publications */}
        <div className="border-t border-brand-divider">
          {posts.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
              <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
              <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">No posts yet</p>
            </div>
          ) : (
            <div>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={viewer?.id ?? ''}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
