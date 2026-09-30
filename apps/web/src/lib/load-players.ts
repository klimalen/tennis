import type { createClient } from '@/lib/supabase/server'
import { skillLabel } from '@/lib/skill'
import { rankPlayers } from '@/lib/player-rank'
import { requestStatuses } from '@/lib/request-status'
import { TRAVEL_RADIUS_KM, boundingBox, haversineKm } from '@/lib/travel'

type Db = Awaited<ReturnType<typeof createClient>>

const NEARBY_CAP = 300
const DEFAULT_PAGE_SIZE = 15

const COLUMNS = 'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name, city_lat, city_lng, bio, looking_for, availability, is_coach'

export type LoadedPlayer = {
  id: string
  username: string
  full_name: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
  preferred_formats: string[]
  play_style: string | null
  total_matches: number
  last_active_at: string | null
  city_name: string | null
  city_lat: number | null
  city_lng: number | null
  distance_km: number | null
  bio: string | null
  looking_for: string | null
  availability: unknown
  following: boolean
  is_coach: boolean | null
}

type LoadArgs = {
  city: string | null
  lat: number | null
  lng: number | null
  exclude: string | null
  offset: number
  q: string
  skills: string[]
  coachesOnly: boolean
  /** Already known from the page. Omit on the API so the session lookup overlaps the profile read. */
  userId?: string | null
  pageSize?: number
}

export async function loadPlayers(supabase: Db, args: LoadArgs): Promise<{
  players: LoadedPlayer[]
  statuses: Record<string, string>
  hasMore: boolean
}> {
  const pageSize = args.pageSize ?? DEFAULT_PAGE_SIZE
  const userIdPromise = args.userId !== undefined
    ? Promise.resolve(args.userId)
    : supabase.auth.getUser().then(({ data: { user } }) => user?.id ?? null)
  const followsPromise = userIdPromise.then((userId) =>
    userId ? followSets(supabase, userId) : Promise.resolve({ following: new Set<string>(), mutual: new Set<string>() }),
  )

  const hasCoords = args.lat !== null && args.lng !== null && !Number.isNaN(args.lat) && !Number.isNaN(args.lng)
  let data: Array<Record<string, unknown>> | null = null
  let error: { message: string } | null = null

  if (hasCoords) {
    const box = boundingBox(args.lat as number, args.lng as number, TRAVEL_RADIUS_KM)
    const safeCity = (args.city ?? '').replace(/[%*,().]/g, '').trim()
    const nearby = `and(city_lat.gte.${box.south},city_lat.lte.${box.north},city_lng.gte.${box.west},city_lng.lte.${box.east})`
    const cityClause = safeCity ? `,city_name.ilike.*${safeCity}*` : ''
    let query = supabase
      .from('profiles')
      .select(COLUMNS)
      .is('deleted_at', null)
      .neq('full_name', '')
      .or(`${nearby}${cityClause}`)
    if (args.exclude) query = query.neq('id', args.exclude)
    if (args.coachesOnly) query = query.eq('is_coach', true)
    const result = await query.order('last_active_at', { ascending: false, nullsFirst: false }).limit(NEARBY_CAP)
    data = result.data
    error = result.error
  } else if (args.city) {
    let query = supabase
      .from('profiles')
      .select(COLUMNS)
      .is('deleted_at', null)
      .neq('full_name', '')
      .ilike('city_name', `%${args.city}%`)
    if (args.exclude) query = query.neq('id', args.exclude)
    if (args.coachesOnly) query = query.eq('is_coach', true)
    const result = await query.order('last_active_at', { ascending: false, nullsFirst: false }).limit(NEARBY_CAP)
    data = result.data
    error = result.error
  } else {
    return { players: [], statuses: {}, hasMore: false }
  }

  if (error) {
    console.error('Players query error:', error)
    return { players: [], statuses: {}, hasMore: false }
  }

  const rows = (data ?? []).map((row) => {
    const cityLat = typeof row.city_lat === 'number' ? row.city_lat : null
    const cityLng = typeof row.city_lng === 'number' ? row.city_lng : null
    const distance_km = hasCoords && cityLat != null && cityLng != null
      ? Math.round(haversineKm(args.lat as number, args.lng as number, cityLat, cityLng) * 10) / 10
      : null
    return {
      ...(row as Omit<LoadedPlayer, 'distance_km' | 'following'>),
      distance_km,
    }
  })

  const filtered = rows.filter((row) => matchesPlayer(row, args.q, args.skills))
  const [userId, follows] = await Promise.all([userIdPromise, followsPromise])
  const ranked = rankPlayers(filtered, args.city, follows.mutual)
  const page = ranked.slice(args.offset, args.offset + pageSize)
  const statuses = userId ? await requestStatuses(supabase, userId, page.map((player) => player.id)) : {}

  return {
    players: page.map((player) => ({ ...player, following: follows.following.has(player.id) })),
    statuses,
    hasMore: args.offset + pageSize < ranked.length,
  }
}

/** First Discover card. Reads the viewer's city itself so the page can run it beside the other queries. */
export async function loadDiscoverPlayer(supabase: Db, userId: string): Promise<{
  player: LoadedPlayer | null
  statuses: Record<string, string>
  ready: boolean
}> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('city_name, city_lat, city_lng')
    .eq('id', userId)
    .maybeSingle()

  if (!profile?.city_name) return { player: null, statuses: {}, ready: false }

  const result = await loadPlayers(supabase, {
    city: profile.city_name,
    lat: profile.city_lat,
    lng: profile.city_lng,
    exclude: userId,
    offset: 0,
    q: '',
    skills: [],
    coachesOnly: false,
    userId,
    pageSize: 1,
  })

  return {
    player: result.players[0] ?? null,
    statuses: result.statuses,
    ready: true,
  }
}

function matchesPlayer(
  player: { full_name: string | null; username: string | null; city_name: string | null; looking_for: string | null; skill_level_self: number | null; skill_level_computed: number | null },
  q: string,
  skills: string[],
) {
  if (q) {
    const hay = `${player.full_name ?? ''} ${player.username ?? ''} ${player.city_name ?? ''} ${player.looking_for ?? ''}`.toLowerCase()
    if (!hay.includes(q)) return false
  }
  if (skills.length > 0) {
    const label = skillLabel(player.skill_level_computed ?? player.skill_level_self)
    if (!label || !skills.includes(label)) return false
  }
  return true
}

async function followSets(supabase: Db, userId: string) {
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
  ])
  const following = new Set((outgoing ?? []).map((row) => row.following_id as string))
  const followsMe = new Set((incoming ?? []).map((row) => row.follower_id as string))
  const mutual = new Set<string>()
  for (const id of following) {
    if (followsMe.has(id)) mutual.add(id)
  }
  return { following, mutual }
}
