import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, MapPin } from 'lucide-react'
import { ProposeMatchButton } from './ProposeMatchButton'
import { FollowButton } from './FollowButton'
import { MessageIcon } from './MessageIcon'
import { SchedulePreview } from '@/components/schedule/ScheduleBlocks'
import { formatFollowers } from '@/lib/formatFollowers'
import { skillLabel } from '@/lib/skill'
import { loadPlayerGames, playedGamesCount } from '@/lib/player-games'
import { summarizeSchedule } from '@/lib/schedule'
import { PostCard, type PostItem } from '@/app/(app)/feed/PostCard'
import { AvailabilityButton } from '@/components/ui/AvailabilityButton'
import { ExpandableText } from '@/components/ui/ExpandableText'
import { LookingFor } from '@/components/ui/LookingFor'
import { hasSlots, normalizeAvailability } from '@/lib/availability'
// ─── Helpers ──────────────────────────────────────────────────────────────────

const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  indoor: 'Indoor',
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
    id: string; creator_id: string; format: string; scheduled_at: string; skill_level_min: number | null
    skill_level_max: number | null; neighborhood: string | null; status: string
    max_players: number; is_open: boolean; city: { name: string } | null
  } | null
  likes: [{ count: number }] | []
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
      'id, full_name, username, avatar_url, bio, looking_for, city_name, skill_level_self, skill_level_computed, preferred_formats, play_style, years_playing, preferred_surfaces, availability',
    )
    .eq('username', username)
    .is('deleted_at', null)
    .single()

  if (!profile) notFound()
  if (viewer && viewer.id === profile.id) redirect('/me')

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', profile.id),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', profile.id),
  ])

  const schedule = summarizeSchedule(await loadPlayerGames(supabase, profile.id))
  const gamesPlayed = await playedGamesCount(supabase, profile.id, schedule.playedCount)

  const surfaces: string[] = profile.preferred_surfaces ?? []
  const availability = normalizeAvailability(profile.availability)

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
    if (!existingRequestStatus || existingRequestStatus === 'pending' || existingRequestStatus === 'cancelled' || existingRequestStatus === 'declined') {
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
  const skill = skillLabel(rating)
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
        id, creator_id, format, scheduled_at, skill_level_min, skill_level_max,
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
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/search" className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">
            {profile.full_name.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-2 pb-8 space-y-6">
        {/* Profile header */}
        <div className="bg-white rounded-[28px] p-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-[#E8748A] flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.full_name} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-3xl text-[#1a1a1a]">{initials}</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around pt-1">
              <Link href={`/profile/${profile.username}/schedule`} className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{gamesPlayed}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Games</span>
              </Link>
              <Link href={`/profile/${profile.username}/followers`} className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{formatFollowers(followerCount ?? 0)}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Followers</span>
              </Link>
              <Link href={`/profile/${profile.username}/following`} className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{formatFollowers(followingCount ?? 0)}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Following</span>
              </Link>
            </div>
          </div>

          {/* Name + meta */}
          <div className="mt-4 space-y-1.5">
            <p className="font-display text-2xl tracking-wide leading-none">{profile.full_name.toUpperCase()}</p>
            <p className="font-fraunces italic text-sm text-[rgba(26,26,26,0.55)]">@{profile.username}</p>

            {profile.city_name && (
              <p className="flex items-center gap-1 text-[11px] text-[rgba(26,26,26,0.45)]">
                <MapPin size={11} />
                {profile.city_name}
              </p>
            )}

            {(skill || surfaces.length > 0 || hasSlots(availability)) && (
              <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
                {skill && (
                  <span className="rounded-full text-[9px] tracking-[0.15em] uppercase text-[#F0EBE3] font-medium bg-[#3A8A7A] px-2.5 py-0.5">
                    {skill}
                  </span>
                )}
                {surfaces.map((s) => (
                  <span key={s} className="rounded-full text-[9px] tracking-[0.12em] uppercase text-[#1a1a1a] bg-brand-field px-2.5 py-0.5">
                    {SURFACE_LABELS[s] ?? s}
                  </span>
                ))}
                <AvailabilityButton value={availability} />
              </div>
            )}

            {profile.bio && (
              <div className="pt-1">
                <ExpandableText text={profile.bio} className="font-copy text-sm text-[#497250] leading-snug" />
              </div>
            )}
            <LookingFor text={profile.looking_for} />
          </div>

          {!viewer && (
            <div className="mt-4 rounded-[20px] bg-[#FAF7F2] px-4 py-4 space-y-3">
              <p className="font-fraunces italic text-sm text-[#497250]">Sign in to follow this player and suggest a match</p>
              <div className="flex gap-2">
                <Link href="/sign-up" className="flex-1 py-2.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.15em] uppercase font-medium text-center hover:bg-[#E8406A] transition-colors">
                  Create free account
                </Link>
                <Link href={`/sign-in?next=/profile/${profile.username}`} className="flex-1 py-2.5 rounded-full bg-white border border-[#1a1a1a]/15 text-[10px] tracking-[0.15em] uppercase font-medium text-center text-[#1a1a1a] hover:bg-brand-field transition-colors">
                  Sign in
                </Link>
              </div>
            </div>
          )}

          {viewer && viewer.id !== profile.id && (
            <div className="mt-4">
              <ProposeMatchButton
                receiverId={profile.id}
                receiverName={profile.full_name}
                existingStatus={existingRequestStatus}
              >
                <FollowButton
                  followingId={profile.id}
                  initialFollowing={viewerIsFollowing}
                />
                {isMutual && (
                  <MessageIcon otherUserId={profile.id} existingConvId={existingConvId} />
                )}
              </ProposeMatchButton>
            </div>
          )}
        </div>

        {schedule.preview.length > 0 && (
          <div>
            <div className="px-1 pb-3 flex items-center gap-2">
              <CalendarDays size={14} className="text-[rgba(26,26,26,0.4)]" />
              <span className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">Schedule</span>
              <div className="flex-1 h-px bg-brand-divider" />
            </div>
            <SchedulePreview
              items={schedule.preview}
              seeAllHref={`/profile/${profile.username}/schedule`}
              viewerId={viewer?.id ?? null}
            />
          </div>
        )}

        <div>
          <div className="px-1 pb-3 flex items-center gap-2">
            <span className="text-brand-accent font-display text-lg leading-none">✦</span>
            <span className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">Posts</span>
            <div className="flex-1 h-px bg-brand-divider" />
          </div>
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
