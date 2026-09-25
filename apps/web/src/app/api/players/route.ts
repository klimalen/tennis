import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 15
const NEARBY_RADIUS_KM = 80

function boundingBox(lat: number, lng: number, radiusKm: number) {
  const earthKm = 6371
  const deltaLat = (radiusKm / earthKm) * (180 / Math.PI)
  const deltaLng = deltaLat / Math.max(0.2, Math.cos((lat * Math.PI) / 180))
  return {
    south: lat - deltaLat,
    north: lat + deltaLat,
    west: lng - deltaLng,
    east: lng + deltaLng,
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const city   = searchParams.get('city')
  const exclude = searchParams.get('exclude')
  const latStr = searchParams.get('lat')
  const lngStr = searchParams.get('lng')
  const offset = Math.max(0, parseInt(searchParams.get('offset') ?? '0', 10))

  const supabase = await createClient()

  const userLat = latStr ? parseFloat(latStr) : null
  const userLng = lngStr ? parseFloat(lngStr) : null

  // Nearby players: bounding box (plus same city name), then sort by distance in memory.
  if (userLat !== null && userLng !== null && !Number.isNaN(userLat) && !Number.isNaN(userLng)) {
    const box = boundingBox(userLat, userLng, NEARBY_RADIUS_KM)
    const safeCity = (city ?? '').replace(/[%*,().]/g, '').trim()
    const nearby = `and(city_lat.gte.${box.south},city_lat.lte.${box.north},city_lng.gte.${box.west},city_lng.lte.${box.east})`
    const cityClause = safeCity ? `,city_name.ilike.*${safeCity}*` : ''

    let query = supabase
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name, city_lat, city_lng, bio, looking_for, availability',
      )
      .is('deleted_at', null)
      .neq('full_name', '')
      .or(`${nearby}${cityClause}`)

    if (exclude) query = query.neq('id', exclude)

    const { data, error } = await query

    if (error) {
      console.error('Players query error:', error)
      return NextResponse.json({ players: [], hasMore: false })
    }

    const rows = data ?? []

    // Sort: same-city players first (by last_active_at), then by distance, null coords last
    rows.sort((a, b) => {
      const aHasCoords = a.city_lat != null && a.city_lng != null
      const bHasCoords = b.city_lat != null && b.city_lng != null

      if (!aHasCoords && !bHasCoords) return 0
      if (!aHasCoords) return 1
      if (!bHasCoords) return -1

      const distA = haversineKm(userLat, userLng, a.city_lat!, a.city_lng!)
      const distB = haversineKm(userLat, userLng, b.city_lat!, b.city_lng!)
      return distA - distB
    })

    const page = rows.slice(offset, offset + PAGE_SIZE)
    const hasMore = offset + PAGE_SIZE < rows.length

    return NextResponse.json({ players: await withFollowing(supabase, page), hasMore })
  }

  // Fallback: city name ilike filter (for users without stored coords)
  if (!city) {
    return NextResponse.json({ players: [], hasMore: false })
  }

  let query = supabase
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name, city_lat, city_lng, bio, looking_for, availability',
    )
    .is('deleted_at', null)
    .neq('full_name', '')
    .ilike('city_name', `%${city}%`)
    .order('last_active_at', { ascending: false, nullsFirst: false })
    .range(offset, offset + PAGE_SIZE - 1)

  if (exclude) query = query.neq('id', exclude)

  const { data, error } = await query

  if (error) {
    console.error('Players query error:', error)
    return NextResponse.json({ players: [], hasMore: false })
  }

  const players = data ?? []
  const hasMore = players.length === PAGE_SIZE

  return NextResponse.json({ players: await withFollowing(supabase, players), hasMore })
}

async function withFollowing<T extends { id: string }>(
  supabase: Awaited<ReturnType<typeof createClient>>,
  players: T[],
) {
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || players.length === 0) {
    return players.map((player) => ({ ...player, following: false }))
  }

  const { data } = await supabase
    .from('follows')
    .select('following_id')
    .eq('follower_id', user.id)
    .in('following_id', players.map((player) => player.id))

  const following = new Set((data ?? []).map((row) => row.following_id as string))
  return players.map((player) => ({ ...player, following: following.has(player.id) }))
}
