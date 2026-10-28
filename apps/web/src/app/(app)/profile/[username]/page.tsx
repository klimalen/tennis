import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, CalendarDays, Globe, MapPin, Phone } from 'lucide-react'
import { ProposeMatchButton } from './ProposeMatchButton'
import { FollowButton } from './FollowButton'
import { MessageIcon } from './MessageIcon'
import { SchedulePreview } from '@/components/schedule/ScheduleBlocks'
import { formatFollowers } from '@/lib/formatFollowers'
import { skillLabel } from '@/lib/skill'
import { loadPlayerGames } from '@/lib/player-games'
import { summarizeSchedule } from '@/lib/schedule'
import { PostCard, type PostItem } from '@/app/(app)/feed/PostCard'
import { AvailabilityButton } from '@/components/ui/AvailabilityButton'
import { CoachBadge } from '@/components/ui/CoachBadge'
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

  const [{ data: { user: viewer } }, { data: profile }] = await Promise.all([
    supabase.auth.getUser(),
    supabase
      .from('profiles')
      .select(
        'id, full_name, username, avatar_url, bio, looking_for, city_name, phone, website, account_kind, skill_level_self, skill_level_computed, preferred_formats, play_style, years_playing, preferred_surfaces, availability, is_coach',
      )
      .eq('username', username)
      .is('deleted_at', null)
      .single(),
  ])

  if (!profile) notFound()
  if (viewer && viewer.id === profile.id) redirect('/me')

  const otherId = viewer && viewer.id !== profile.id ? viewer.id : null
  const [
    { count: followerCount },
    { count: followingCount },
    playerGames,
    playedCountResult,
    { data: postRows },
    likesResult,
    sentReq,
    receivedReq,
    followOut,
    followIn,
    convIdResult,
    viewerProfileResult,
    hasSharedChat,
  ] = await Promise.all([
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('following_id', profile.id),
    supabase.from('follows').select('*', { count: 'exact', head: true }).eq('follower_id', profile.id),
    loadPlayerGames(supabase, profile.id),
    supabase.rpc('played_games_count', { p_player_id: profile.id }),
    supabase
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
      .limit(30),
    otherId
      ? supabase.from('post_likes').select('post_id').eq('user_id', otherId)
      : Promise.resolve({ data: [] as { post_id: string }[] }),
    otherId
      ? supabase.from('game_requests').select('status').eq('sender_id', otherId).eq('receiver_id', profile.id).maybeSingle()
      : Promise.resolve({ data: null as { status: string } | null }),
    otherId
      ? supabase.from('game_requests').select('status').eq('sender_id', profile.id).eq('receiver_id', otherId).in('status', ['accepted', 'matched']).maybeSingle()
      : Promise.resolve({ data: null as { status: string } | null }),
    otherId
      ? supabase.from('follows').select('follower_id').eq('follower_id', otherId).eq('following_id', profile.id).maybeSingle()
      : Promise.resolve({ data: null }),
    otherId
      ? supabase.from('follows').select('follower_id').eq('follower_id', profile.id).eq('following_id', otherId).maybeSingle()
      : Promise.resolve({ data: null }),
    otherId
      ? supabase.rpc('shared_conversation_id', { other_user_id: profile.id })
      : Promise.resolve({ data: null as string | null }),
    otherId
      ? supabase.from('profiles').select('account_kind').eq('id', otherId).maybeSingle()
      : Promise.resolve({ data: null as { account_kind: string | null } | null }),
    otherId
      ? (async () => {
          const { data: profileConvs } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', profile.id)
          const profileConvIds = (profileConvs ?? []).map((row) => row.conversation_id as string)
          if (profileConvIds.length === 0) return false
          const { data: convParticipant } = await supabase
            .from('conversation_participants')
            .select('conversation_id')
            .eq('user_id', otherId)
            .in('conversation_id', profileConvIds)
            .maybeSingle()
          return !!convParticipant
        })()
      : Promise.resolve(false),
  ])

  const schedule = summarizeSchedule(playerGames)
  const gamesPlayed = typeof playedCountResult.data === 'number' && !playedCountResult.error
    ? playedCountResult.data
    : schedule.playedCount

  const surfaces: string[] = profile.preferred_surfaces ?? []
  const availability = normalizeAvailability(profile.availability)

  const viewerIsFollowing = !!followOut.data
  const profileFollowsViewer = !!followIn.data
  const existingConvId = convIdResult.data ?? null
  const viewerIsCourt = viewerProfileResult.data?.account_kind === 'court'
  const isMutual = viewerIsFollowing && profileFollowsViewer

  let existingRequestStatus: string | null = sentReq.data?.status ?? null
  if (!existingRequestStatus && receivedReq.data?.status) existingRequestStatus = receivedReq.data.status
  if (
    hasSharedChat
    && (!existingRequestStatus || existingRequestStatus === 'pending' || existingRequestStatus === 'cancelled' || existingRequestStatus === 'declined')
  ) {
    existingRequestStatus = 'matched'
  }

  const isCourt = profile.account_kind === 'court'
  const rating = profile.is_coach ? null : profile.skill_level_computed ?? profile.skill_level_self
  const skill = isCourt ? null : skillLabel(rating)
  const websiteHref = profile.website
    ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)
    : null
  const initials = profile.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  const rows = (postRows ?? []) as unknown as PostRow[]
  const likedSet = new Set((likesResult.data ?? []).map((like) => like.post_id as string))

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
      <div className="page-header">
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
        <div className="relative bg-white rounded-[28px] p-5">
          {!isCourt && profile.is_coach && <CoachBadge className="absolute -top-2.5 right-4 z-10 shadow-sm" />}
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-brand-avatar flex items-center justify-center overflow-hidden">
                {profile.avatar_url ? (
                  <Image src={profile.avatar_url} alt={profile.full_name} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-3xl text-[#1a1a1a]">{initials}</span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around pt-1">
              {!isCourt && (
                <Link href={`/profile/${profile.username}/schedule`} className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                  <span className="font-numbers text-3xl leading-none text-brand-primary">{gamesPlayed}</span>
                  <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Games</span>
                </Link>
              )}
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
            {(profile.phone || websiteHref) && (
              <div className="pt-1 space-y-1">
                {profile.phone && (
                  <a href={`tel:${profile.phone}`} className="flex items-center gap-1.5 text-sm text-[rgba(26,26,26,0.65)]">
                    <Phone size={12} /> {profile.phone}
                  </a>
                )}
                {websiteHref && (
                  <a href={websiteHref} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1.5 text-sm text-[rgba(26,26,26,0.65)] underline underline-offset-2">
                    <Globe size={12} /> {profile.website}
                  </a>
                )}
              </div>
            )}
            {!isCourt && <LookingFor text={profile.looking_for} />}
          </div>

          {!viewer && (
            <div className="mt-4 rounded-[20px] bg-[#FAF7F2] px-4 py-4 space-y-3">
              <p className="font-fraunces italic text-sm text-[#497250]">{isCourt ? 'Sign in to message this court' : 'Sign in to follow this player and suggest a match'}</p>
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
              {isCourt || viewerIsCourt ? (
                <div className="flex items-center gap-2">
                  <FollowButton followingId={profile.id} initialFollowing={viewerIsFollowing} />
                  {(isCourt || isMutual) && (
                    <MessageIcon otherUserId={profile.id} existingConvId={existingConvId} />
                  )}
                </div>
              ) : (
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
              )}
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
