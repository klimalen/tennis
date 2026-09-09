import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

const PAGE_SIZE = 15

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

  // When user coordinates are provided: fetch all players, sort by distance
  if (userLat !== null && userLng !== null) {
    let query = supabase
      .from('profiles')
      .select(
        'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name, city_lat, city_lng, bio, looking_for',
      )
      .is('deleted_at', null)
      .neq('full_name', '')

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

    return NextResponse.json({ players: page, hasMore })
  }

  // Fallback: city name ilike filter (for users without stored coords)
  if (!city) {
    return NextResponse.json({ players: [], hasMore: false })
  }

  let query = supabase
    .from('profiles')
    .select(
      'id, username, full_name, avatar_url, skill_level_self, skill_level_computed, preferred_formats, play_style, total_matches, last_active_at, city_name, city_lat, city_lng, bio, looking_for',
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

  return NextResponse.json({ players, hasMore })
}
