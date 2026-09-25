import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { Settings, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { CreateSheet } from '@/components/navigation/CreateSheet'
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

const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  indoor: 'Indoor',
}

async function ProfileContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, avatar_url, skill_level_self, skill_level_computed, bio, looking_for, city_name, preferred_surfaces, availability')
    .eq('id', user.id)
    .single()

  const [{ count: followerCount }, { count: followingCount }] = await Promise.all([
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('follower_id', user.id),
  ])

  const schedule = summarizeSchedule(await loadPlayerGames(supabase, user.id))
  const gamesPlayed = await playedGamesCount(supabase, user.id, schedule.playedCount)

  // Fetch own posts
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
    .eq('author_id', user.id)
    .order('created_at', { ascending: false })
    .limit(30)

  const postIds = (postRows ?? []).map((p) => p.id as string)
  const { data: myLikes } = postIds.length > 0
    ? await supabase.from('post_likes').select('post_id').eq('user_id', user.id).in('post_id', postIds)
    : { data: [] }
  const likedSet = new Set((myLikes ?? []).map((l) => l.post_id as string))

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

  const fullName = profile?.full_name || 'Tennis Player'
  const username = profile?.username || ''
  const avatarUrl = profile?.avatar_url || null
  const rating = profile?.skill_level_computed ?? profile?.skill_level_self ?? null
  const surfaces: string[] = profile?.preferred_surfaces ?? []
  const availability = normalizeAvailability(profile?.availability)

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-5xl tracking-wide text-[#1a1a1a]">PROFILE</span>
          <Link href="/settings" className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <Settings size={16} className="text-[rgba(26,26,26,0.5)]" />
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-2 space-y-4">
        {/* Profile header */}
        <div className="bg-white rounded-[28px] p-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="flex-shrink-0">
              <div className="w-20 h-20 rounded-full bg-[#E8748A] flex items-center justify-center overflow-hidden">
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
              <Link href="/schedule" className="flex flex-col items-center gap-0.5 min-w-0 text-center hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{gamesPlayed}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Games</span>
              </Link>
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

          {/* Name + meta */}
          <div className="mt-4">
            <p className="font-display text-2xl tracking-wide leading-none">{fullName.toUpperCase()}</p>
            {username && (
              <p className="font-fraunces italic text-sm text-[rgba(26,26,26,0.55)] mt-1">@{username}</p>
            )}
            {profile?.city_name && (
              <p className="text-[11px] text-[rgba(26,26,26,0.4)] mt-0.5 flex items-center gap-1">
                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M20 10c0 6-8 13-8 13S4 16 4 10a8 8 0 0 1 16 0Z"/><circle cx="12" cy="10" r="3"/></svg>
                {profile.city_name}
              </p>
            )}
            {(skillLabel(rating) || surfaces.length > 0 || hasSlots(availability)) && (
              <div className="flex flex-wrap items-center gap-1.5 mt-2">
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
            {profile?.bio && (
              <div className="mt-2">
                <ExpandableText text={profile.bio} className="text-sm text-[#497250] italic leading-snug" />
              </div>
            )}
            <LookingFor text={profile?.looking_for} />
          </div>
        </div>

        {/* Schedule section */}
        <div>
          <div className="px-1 py-3 flex items-center gap-2">
            <CalendarDays size={14} className="text-[rgba(26,26,26,0.4)]" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">Schedule</span>
            <div className="flex-1 h-px bg-brand-divider" />
            <CreateSheet variant="schedule" direct="game" />
          </div>

          <SchedulePreview
            items={schedule.preview}
            seeAllHref="/schedule"
            viewerId={user.id}
            allowEdit
            empty={(
              <div className="px-1 pb-2">
                <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">No games yet</p>
                <p className="text-xs text-[#85648F] font-fraunces italic mt-0.5">Tap + to add your first game</p>
              </div>
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

export default async function MePage() {
  return (
    <AuthGate section="me">
      <ProfileContent />
    </AuthGate>
  )
}
