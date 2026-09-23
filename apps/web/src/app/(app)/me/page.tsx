import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { Settings, CalendarDays, Pencil } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { CreateSheet } from '@/components/navigation/CreateSheet'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'
import { formatFollowers } from '@/lib/formatFollowers'
import { formatPlayFormat, skillLabel } from '@/lib/skill'
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
    .select('full_name, username, avatar_url, skill_level_self, skill_level_computed, total_matches, bio, looking_for, city_name, preferred_surfaces, availability')
    .eq('id', user.id)
    .single()

  const [{ count: wins }, { count: followerCount }] = await Promise.all([
    supabase
      .from('match_results')
      .select('*', { count: 'exact', head: true })
      .eq('winner_id', user.id)
      .eq('status', 'confirmed'),
    supabase
      .from('follows')
      .select('*', { count: 'exact', head: true })
      .eq('following_id', user.id),
  ])

  // Games created by user
  const { data: createdGames } = await supabase
    .from('games')
    .select('id, scheduled_at, format, neighborhood, status, is_open')
    .eq('creator_id', user.id)
    .eq('status', 'confirmed')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  // Games where user is an accepted participant (invited by someone else)
  const { data: acceptedParticipations } = await supabase
    .from('game_participants')
    .select('game_id')
    .eq('player_id', user.id)
    .eq('status', 'accepted')

  const acceptedGameIds = (acceptedParticipations ?? []).map((r) => r.game_id as string)

  const { data: invitedGames } = acceptedGameIds.length > 0
    ? await supabase
        .from('games')
        .select('id, scheduled_at, format, neighborhood, status, is_open')
        .in('id', acceptedGameIds)
        .neq('creator_id', user.id)
        .eq('status', 'confirmed')
        .gte('scheduled_at', new Date().toISOString())
    : { data: [] }

  // Merge and sort
  const now = new Date().toISOString()
  const upcomingGames = [...(createdGames ?? []), ...(invitedGames ?? [])]
    .filter((g) => g.scheduled_at >= now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
    .slice(0, 5)

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
  const totalMatches = profile?.total_matches ?? 0
  const totalWins = wins ?? 0
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
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{totalMatches}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Matches</span>
              </div>
              <div className="flex flex-col items-center gap-0.5">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{totalWins}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Wins</span>
              </div>
              <Link href="/me/followers" className="flex flex-col items-center gap-0.5 hover:opacity-70 transition-opacity">
                <span className="font-numbers text-3xl leading-none text-brand-primary">{formatFollowers(followerCount ?? 0)}</span>
                <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">Followers</span>
              </Link>
            </div>
          </div>

          {/* Name + meta */}
          <div className="mt-4">
            <p className="font-display text-2xl tracking-wide leading-none">{fullName.toUpperCase()}</p>
            {username && (
              <p className="font-fraunces italic text-sm text-[#85648F] mt-1">@{username}</p>
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
                <ExpandableText text={profile.bio} className="text-sm text-[#497250] font-fraunces italic leading-snug" />
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
            <CreateSheet variant="schedule" />
          </div>

          {upcomingGames && upcomingGames.length > 0 ? (
            <div className="pb-4">
              {upcomingGames.map((game) => {
                const formatLabel = formatPlayFormat(game.format)
                return (
                  <div key={game.id} className="mb-3 px-4 py-4 rounded-[28px] bg-white flex items-center gap-4">
                    <div className="flex-shrink-0 w-10 text-center">
                      <p className="font-numbers text-xl leading-none text-brand-primary"><LocalGameDay iso={game.scheduled_at} /></p>
                      <p className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.4)]">
                        <LocalGameMonth iso={game.scheduled_at} />
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <p className="text-sm font-medium text-[#1a1a1a]">{formatLabel}</p>
                        {game.is_open && (
                          <span className="text-[8px] tracking-[0.15em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5">Open</span>
                        )}
                      </div>
                      <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">
                        <LocalGameTime iso={game.scheduled_at} />{game.neighborhood ? ` · ${game.neighborhood}` : ''}
                      </p>
                    </div>
                    <Link
                      href={`/games/${game.id}/edit`}
                      className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.3)] hover:text-brand-primary transition-colors flex-shrink-0"
                    >
                      <Pencil size={14} />
                    </Link>
                  </div>
                )
              })}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
              <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-1">No upcoming games</p>
              <p className="text-xs text-[#85648F] font-fraunces italic">
                Tap + to add your first game
              </p>
            </div>
          )}
        </div>

        <div>
          <div className="px-1 pt-2 pb-3 flex items-center gap-2">
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
