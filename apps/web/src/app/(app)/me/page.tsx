import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { getCurrentUser } from '@/lib/supabase/user'
import { ArrowUpRight, Settings, CalendarDays, ChevronRight } from 'lucide-react'
import { ShareLinkButton } from '@/components/share/ShareLinkButton'
import Link from 'next/link'
import Image from 'next/image'
import { CreateSheet } from '@/components/navigation/CreateSheet'
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
import { CourtProfileDetails } from '@/components/court/CourtProfileDetails'
import { CourtDetailsGate } from './CourtHome'

const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  carpet: 'Carpet',
  synthetic: 'Synthetic',
}

async function ProfileContent() {
  const supabase = await createClient()
  const user = await getCurrentUser()
  if (!user) return null

  const [profileResult, followerResult, followingResult, playerGames, postsResult, playedCountResult, myLikesResult, venueResult] = await Promise.all([
    supabase
      .from('profiles')
      .select('full_name, username, avatar_url, skill_level_self, skill_level_computed, bio, looking_for, city_name, city_lat, city_lng, address, phone, website, opening_hours, account_kind, preferred_surfaces, availability, is_coach, court_count, has_indoor, has_outdoor, lit, fee_hour_min, fee_hour_max, whatsapp, instagram, telegram, facebook')
      .eq('id', user.id)
      .single(),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id),
    loadPlayerGames(supabase, user.id),
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
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30),
    supabase.rpc('played_games_count', { p_player_id: user.id }),
    supabase.from('post_likes').select('post_id').eq('user_id', user.id),
    supabase
      .from('venue_groups')
      .select('id')
      .eq('profile_id', user.id)
      .limit(1)
      .maybeSingle(),
  ])

  const profile = profileResult.data
  const isCourt = profile?.account_kind === 'court'
  if (
    isCourt
    && (
      !profile?.full_name?.trim()
      || !profile?.city_name?.trim()
      || !profile?.address?.trim()
      || !profile?.phone?.trim()
    )
  ) {
    return <CourtDetailsGate />
  }
  const followerCount = followerResult.count
  const followingCount = followingResult.count
  const schedule = summarizeSchedule(playerGames)
  const postRows = postsResult.data
  const gamesPlayed = typeof playedCountResult.data === 'number' && !playedCountResult.error
    ? playedCountResult.data
    : schedule.playedCount
  const likedSet = new Set((myLikesResult.data ?? []).map((like) => like.post_id as string))

  interface PostRow {
    id: string; type: string; body: string | null; image_url: string | null
    created_at: string; updated_at: string
    author: { id: string; full_name: string; username: string; avatar_url: string | null }
    match_result: {
      id: string; winner_id: string | null; winning_team: number | null; played_at: string | null
      winner: { full_name: string; username: string } | null
      game: { format: string; scheduled_at: string } | null
    } | null
    game: {
      id: string; creator_id: string; format: string; scheduled_at: string
      skill_level_min: number | null; skill_level_max: number | null
      neighborhood: string | null; status: string; max_players: number
      is_open: boolean; city: { name: string } | null
    } | null
    likes: [{ count: number }] | []
  }
  const posts: PostItem[] = ((postRows ?? []) as unknown as PostRow[]).map((row) => ({
    id: row.id,
    type: row.type as PostItem['type'],
    body: row.body,
    image_url: row.image_url,
    created_at: row.created_at,
    updated_at: row.updated_at ?? row.created_at,
    author: row.author as PostItem['author'],
    match_result: row.match_result as PostItem['match_result'],
    game: row.game as PostItem['game'],
    likes_count: (row.likes as [{ count: number }] | [])[0]?.count ?? 0,
    liked_by_me: likedSet.has(row.id),
  }))

  const fullName = profile?.full_name || (isCourt ? 'Court' : 'Tennis Player')
  const username = profile?.username || ''
  const courtHref = isCourt
    ? (venueResult.data?.id ? `/court/${venueResult.data.id}` : (username ? `/profile/${username}` : null))
    : null
  const avatarUrl = profile?.avatar_url || null
  const rating = profile?.is_coach ? null : (profile?.skill_level_computed ?? profile?.skill_level_self ?? null)
  const surfaces: string[] = profile?.preferred_surfaces ?? []
  const availability = normalizeAvailability(profile?.availability)

  return (
    <div className="min-h-screen">
      {/* Header */}
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-4xl tracking-wide leading-none text-[#1a1a1a]">PROFILE</span>
          <div className="flex items-center gap-2">
            {username && (
              <ShareLinkButton
                path={`/profile/${username}`}
                title={`${fullName} on GAME.`}
                text={`${fullName} on GAME.`}
              />
            )}
            <Link href="/settings" className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
              <Settings size={16} className="text-[rgba(26,26,26,0.5)]" />
            </Link>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 space-y-4">
        {/* Profile header */}
        <div className="relative bg-white rounded-[28px] p-5">
          <div className="flex items-start gap-5">
            {/* Avatar — coach badge sits centered on the top edge */}
            <div className="relative flex-shrink-0">
              {!isCourt && profile?.is_coach && (
                <CoachBadge className="absolute left-1/2 top-0 -translate-x-1/2 -translate-y-1/2 shadow-sm" />
              )}
              <div className="w-20 h-20 rounded-full bg-brand-avatar flex items-center justify-center overflow-hidden">
                {avatarUrl ? (
                  <Image src={avatarUrl} alt={fullName} width={80} height={80} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-3xl text-[#1a1a1a]">
                    {fullName.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()}
                  </span>
                )}
              </div>
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around pt-1">
              {!isCourt && (
                <Link href="/schedule" className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                  <span className="font-numbers text-3xl leading-none text-brand-primary">{gamesPlayed}</span>
                  <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Games</span>
                </Link>
              )}
              <Link href="/me/followers" className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{formatFollowers(followerCount ?? 0)}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Followers</span>
              </Link>
              <Link href="/me/following" className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{formatFollowers(followingCount ?? 0)}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Following</span>
              </Link>
            </div>
          </div>

          {/* Name + meta — handle sits on the name row so address/city can come next */}
          <div className="mt-4">
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-1">
              {courtHref ? (
                <Link
                  href={courtHref}
                  className="group inline-flex items-center gap-1.5 max-w-full hover:opacity-80 transition-opacity"
                >
                  <p className="font-display text-2xl tracking-wide leading-none">{fullName.toUpperCase()}</p>
                  <ArrowUpRight size={16} className="flex-shrink-0 text-[rgba(26,26,26,0.4)] group-hover:text-[#1a1a1a] transition-colors" aria-hidden />
                </Link>
              ) : (
                <p className="font-display text-2xl tracking-wide leading-none">{fullName.toUpperCase()}</p>
              )}
              {username && (
                <span className="text-[11px] tracking-[0.04em] text-[rgba(26,26,26,0.28)]">@{username}</span>
              )}
            </div>
            {!isCourt && profile?.city_name && (
              <p className="text-[11px] text-[rgba(26,26,26,0.4)] mt-0.5 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 13-8 13S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {profile.city_name}
              </p>
            )}
            {!isCourt && (skillLabel(rating) || surfaces.length > 0 || hasSlots(availability)) && (
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {skillLabel(rating) && (
                  <span className="rounded-full text-[9px] tracking-[0.15em] uppercase text-[#F0EBE3] font-medium bg-[#3A8A7A] px-2.5 py-0.5">
                    {skillLabel(rating)}
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
            {!isCourt && profile?.bio && (
              <div className="mt-2">
                <ExpandableText text={profile.bio} className="font-copy text-sm text-[#497250] leading-snug" />
              </div>
            )}
            {!isCourt && <LookingFor text={profile?.looking_for} />}
            {isCourt && (
              <div className="mt-2">
                <CourtProfileDetails
                  cityName={profile?.city_name}
                  address={profile?.address}
                  phone={profile?.phone}
                  website={profile?.website}
                  openingHours={profile?.opening_hours}
                  bio={profile?.bio}
                  courtCount={profile?.court_count}
                  surfaces={profile?.preferred_surfaces}
                  hasIndoor={profile?.has_indoor}
                  hasOutdoor={profile?.has_outdoor}
                  lit={profile?.lit}
                  feeHourMin={profile?.fee_hour_min}
                  feeHourMax={profile?.fee_hour_max}
                  whatsapp={profile?.whatsapp}
                  instagram={profile?.instagram}
                  telegram={profile?.telegram}
                  facebook={profile?.facebook}
                />
              </div>
            )}
          </div>
        </div>

        {/* Schedule section */}
        <div>
          <div className="px-1 py-3 flex items-center gap-2">
            <Link
              href="/schedule"
              className="flex min-w-0 flex-1 items-center gap-2 transition-opacity hover:opacity-70"
            >
              <CalendarDays size={14} className="text-[rgba(26,26,26,0.4)]" />
              <span className="inline-flex items-center gap-0.5 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">
                Schedule
                <ChevronRight size={11} className="text-[rgba(26,26,26,0.4)]" aria-hidden />
              </span>
              <div className="flex-1 h-px bg-brand-divider" />
            </Link>
            <CreateSheet variant="schedule" direct="game" />
          </div>

          <SchedulePreview
            items={schedule.preview}
            viewerId={user.id}
            allowEdit
            empty={(
              <EmptySection title="No games yet" hint="Tap + to add your first game" />
            )}
          />
        </div>

        <div>
          <div className="px-1 pt-2 pb-3 flex items-center gap-2">
            <span className="text-brand-accent font-display text-lg leading-none">✦</span>
            <span className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">Posts</span>
            <div className="flex-1 h-px bg-brand-divider" />
            <CreateSheet variant="schedule" direct="post" />
          </div>
          {posts.length === 0 ? (
            <EmptySection title="No posts yet" hint="Tap + to add your first post" />
          ) : (
            <div>
              {posts.map((post) => (
                <PostCard
                  key={post.id}
                  post={post}
                  currentUserId={user.id}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

function EmptySection({ title, hint }: { title: string; hint: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
      <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">{title}</p>
      <p className="mt-0.5 font-fraunces text-xs italic text-[#85648F]">{hint}</p>
    </div>
  )
}

export default async function MePage() {
  return (
    <AuthGate section="me">
      <ProfileContent />
    </AuthGate>
  )
}
