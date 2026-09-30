import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { skillLabel } from '@/lib/skill'
import { rankPlayers } from '@/lib/player-rank'
import { TRAVEL_RADIUS_KM, boundingBox, haversineKm } from '@/lib/travel'

const PAGE_SIZE = 15
const NEARBY_CAP = 300

const SKILL_FILTERS = new Set(['Beginner', 'Intermediate', 'Advanced', 'Competitive'])

function selectedSkills(value: string | null): string[] {
  if (!value) return []
  return value.split(',').map((part) => part.trim()).filter((part) => SKILL_FILTERS.has(part))
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

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const city   = searchParams.get('city')
  const exclude = searchParams.get('exclude')
  const latStr = searchParams.get('lat')
  const lngStr = searchParams.get('lng')
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))
  const q = (searchParams.get('q') ?? '').trim().toLowerCase().slice(0, 80)
  const skills = selectedSkills(searchParams.get('skill'))
  const coachesOnly = searchParams.get('coach') === '1'

  const supabase = await createClient()

  const userLat = latStr ? parseFloat(latStr) : null
  const userLng = lngStr ? parseFloat(lngStr) : null

  const columns = 'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name, city_lat, city_lng, bio, looking_for, availability, is_coach'
  const hasCoords = userLat !== null && userLng !== null && !Number.isNaN(userLat) && !Number.isNaN(userLng)

  // Same city name is included even when the saved point is far away. Other
  // cities inside the travel radius come back too; ranking places them after.
  let data: Array<Record<string, unknown>> | null = null
  let error: { message: string } | null = null

  if (hasCoords) {
    const box = boundingBox(userLat, userLng, TRAVEL_RADIUS_KM)
    const safeCity = (city ?? '').replace(/[%*,().]/g, '').trim()
    const nearby = `and(city_lat.gte.${box.south},city_lat.lte.${box.north},city_lng.gte.${box.west},city_lng.lte.${box.east})`
    const cityClause = safeCity ? `,city_name.ilike.*${safeCity}*` : ''

    let query = supabase
      .from('profiles')
      .select(columns)
      .is('deleted_at', null)
      .neq('full_name', '')
      .or(`${nearby}${cityClause}`)

    if (exclude) query = query.neq('id', exclude)
    if (coachesOnly) query = query.eq('is_coach', true)

    const result = await query
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .limit(NEARBY_CAP)
    data = result.data
    error = result.error
  } else if (city) {
    let query = supabase
      .from('profiles')
      .select(columns)
      .is('deleted_at', null)
      .neq('full_name', '')
      .ilike('city_name', `%${city}%`)

    if (exclude) query = query.neq('id', exclude)
    if (coachesOnly) query = query.eq('is_coach', true)

    const result = await query
      .order('last_active_at', { ascending: false, nullsFirst: false })
      .limit(NEARBY_CAP)
    data = result.data
    error = result.error
  } else {
    return NextResponse.json({ players: [], hasMore: false })
  }

  if (error) {
    console.error('Players query error:', error)
    return NextResponse.json({ players: [], hasMore: false })
  }

  const rows = (data ?? []).map((row) => {
    const cityLat = typeof row.city_lat === 'number' ? row.city_lat : null
    const cityLng = typeof row.city_lng === 'number' ? row.city_lng : null
    const distance_km = hasCoords && cityLat != null && cityLng != null
      ? Math.round(haversineKm(userLat, userLng, cityLat, cityLng) * 10) / 10
      : null
    return { ...row, distance_km } as typeof row & {
      id: string
      city_name: string | null
      last_active_at: string | null
      distance_km: number | null
      full_name: string | null
      username: string | null
      looking_for: string | null
      skill_level_self: number | null
      skill_level_computed: number | null
    }
  })

  const filtered = rows.filter((row) => matchesPlayer(row, q, skills))
  const { data: { user } } = await supabase.auth.getUser()
  const friendIds = user ? await mutualFriendIds(supabase, user.id) : new Set<string>()
  const ranked = rankPlayers(filtered, city, friendIds)
  const page = ranked.slice(offset, offset + PAGE_SIZE)

  return NextResponse.json({
    players: await withFollowing(supabase, page, user?.id ?? null),
    hasMore: offset + PAGE_SIZE < ranked.length,
  })
}

async function mutualFriendIds(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
): Promise<Set<string>> {
  const [{ data: outgoing }, { data: incoming }] = await Promise.all([
    supabase.from('follows').select('following_id').eq('follower_id', userId),
    supabase.from('follows').select('follower_id').eq('following_id', userId),
  ])
  const followsMe = new Set((incoming ?? []).map((row) => row.follower_id as string))
  const mutual = new Set<string>()
  for (const row of outgoing ?? []) {
    const id = row.following_id as string
    if (followsMe.has(id)) mutual.add(id)
  }
  return mutual
}

async function withFollowing<T extends { id: string }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  players: T[],
  userId: string | null,
) {
  if (!userId || players.length === 0) {
    return players.map((player) => ({ ...player, following: false }))
  }

  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', userId)
    .in('following_id', players.map((player) => player.id))

  const following = new Set((data ?? []).map((row) => row.following_id as string))
  return players.map((player) => ({ ...player, following: following.has(player.id) }))
}
