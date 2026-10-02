import { createClient } from '@/lib/supabase/server'
import { TRAVEL_RADIUS_KM, haversineKm } from '@/lib/travel'
import type { GameCourt } from '@/lib/game-court'
import { compareOpenGames } from '@/lib/open-games-order'
import { NextRequest, NextResponse } from 'next/server'

export interface OpenGameProfile {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  skill_level_self: number | null
  skill_level_computed: number | null
  account_kind: string | null
}

export interface OpenGameParticipant {
  player_id: string
  status: string
  profile: OpenGameProfile
}

export interface OpenGame {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  format: string
  neighborhood: string | null
  notes: string | null
  court_cost_cents: number | null
  payment: string | null
  court: GameCourt | null
  creator_id: string
  max_players: number
  creator: OpenGameProfile & { city_name: string | null }
  participants: OpenGameParticipant[]
  distance_km: number | null
}

export async function GET(request: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ games: [] })

  const city = request.nextUrl.searchParams.get('city')
  const latStr = request.nextUrl.searchParams.get('lat')
  const lngStr = request.nextUrl.searchParams.get('lng')
  const lat = latStr == null ? Number.NaN : Number(latStr)
  const lng = lngStr == null ? Number.NaN : Number(lngStr)
  const hasAnchor = Number.isFinite(lat) && Number.isFinite(lng)

  const { data, error } = await supabase
    .from('games')
    .select(`
      id, scheduled_at, duration_minutes, format, neighborhood, notes, creator_id, max_players,
      court_cost_cents, payment,
      venue:venue_groups!games_venue_group_id_fkey ( id, name, address, lit, fee, access, phone, website, google_maps_uri, lat, lng ),
      creator:profiles!games_creator_id_fkey ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed, account_kind, city_name, city_lat, city_lng ),
      game_participants ( player_id, status, profiles ( id, full_name, username, avatar_url, skill_level_self, skill_level_computed, account_kind ) )
    `)
    .eq('is_open', true)
    .gt('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(200)

  if (error) {
    console.error('[GET /api/open-games] error:', error)
    return NextResponse.json({ games: [] })
  }

  // A game has no city of its own. The place field is free text, so distance
  // uses the creator's city. Nearby cities stay visible, nearest first.
  const ranked = (data ?? []).flatMap((r) => {
    const creator = r.creator as unknown as OpenGame['creator'] & {
      city_lat: number | null
      city_lng: number | null
    }
    const sameCity = !!city && !!creator.city_name && creator.city_name.toLowerCase().includes(city.toLowerCase())
    const distance_km = hasAnchor && creator.city_lat != null && creator.city_lng != null
      ? Math.round(haversineKm(lat, lng, creator.city_lat, creator.city_lng) * 10) / 10
      : null
    if (hasAnchor) {
      const near = distance_km != null && distance_km <= TRAVEL_RADIUS_KM
      if (!near && !sameCity) return []
    } else if (city && !sameCity) {
      return []
    }
    const participants: OpenGameParticipant[] = (r.game_participants ?? []).map((p) => ({
      player_id: p.player_id,
      status: p.status,
      profile: p.profiles as unknown as OpenGameProfile,
    }))
    const { city_lat: _lat, city_lng: _lng, ...creatorPublic } = creator
    void _lat
    void _lng
    const venue = r.venue as unknown as GameCourt | GameCourt[] | null
    const court = Array.isArray(venue) ? venue[0] ?? null : venue
    const game: OpenGame = {
      id: r.id,
      scheduled_at: r.scheduled_at,
      duration_minutes: r.duration_minutes ?? null,
      format: r.format,
      neighborhood: r.neighborhood ?? null,
      notes: r.notes ?? null,
      court_cost_cents: r.court_cost_cents ?? null,
      payment: r.payment ?? null,
      court: court?.id ? court : null,
      creator_id: r.creator_id,
      max_players: r.max_players,
      creator: creatorPublic,
      participants,
      distance_km,
    }
    return [game]
  })

  ranked.sort(compareOpenGames(user.id))

  const games = ranked

  return NextResponse.json({ games })
}
