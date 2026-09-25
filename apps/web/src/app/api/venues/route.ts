import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function degreesToRadians(deg: number): number {
  return (deg * Math.PI) / 180
}

/** Returns a bounding box [south, west, north, east] from a centre + radius in km */
function boundingBox(lat: number, lng: number, radiusKm: number) {
  const earthKm = 6371
  const deltaLat = (radiusKm / earthKm) * (180 / Math.PI)
  const deltaLng = deltaLat / Math.cos(degreesToRadians(lat))
  return {
    south: lat - deltaLat,
    north: lat + deltaLat,
    west: lng - deltaLng,
    east: lng + deltaLng,
  }
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371
  const dLat = degreesToRadians(lat2 - lat1)
  const dLng = degreesToRadians(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(degreesToRadians(lat1)) * Math.cos(degreesToRadians(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

// Max venues to return to the client
const MAX_RESULTS = 20
const MAX_RADIUS_KM = 25
const QUERY_CAP = 200
// Venues within this radius (metres) are considered the same physical location
const CLUSTER_RADIUS_M = 250

/**
 * Shape returned to the client. One card = one organization / facility.
 * Backed by `venue_groups` where the catalog pipeline has run, or by runtime
 * clustering of raw `venues` rows elsewhere.
 */
export interface VenueCard {
  id: string
  osm_id: string | null
  name: string
  kind: string
  lat: number
  lng: number
  address: string | null
  surface: string | null
  court_count: number | null
  lit: boolean | null
  access: string | null
  fee: boolean | null
  website: string | null
  phone: string | null
  operator: string | null
  opening_hours: string | null
  description: string | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  google_maps_uri: string | null
  member_count: number
  confidence: 'low' | 'medium' | 'high'
}

interface GroupRow {
  id: string
  name: string | null
  kind: string
  lat: number
  lng: number
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  description: string | null
  court_count: number | null
  court_count_osm: number
  member_count: number
  surface: string | null
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  access: string | null
  fee: boolean | null
  google_maps_uri: string | null
  confidence: 'low' | 'medium' | 'high'
}

function groupToCard(g: GroupRow): VenueCard {
  return {
    id: g.id,
    osm_id: null,
    name: g.name ?? 'Tennis Courts',
    kind: g.kind,
    lat: g.lat,
    lng: g.lng,
    address: g.address,
    surface: g.surface,
    court_count: g.court_count ?? (g.court_count_osm > 0 ? g.court_count_osm : null),
    lit: g.lit,
    access: g.access,
    fee: g.fee,
    website: g.website,
    phone: g.phone,
    operator: null,
    opening_hours: g.opening_hours,
    description: g.description,
    has_indoor: g.has_indoor,
    has_outdoor: g.has_outdoor,
    google_maps_uri: g.google_maps_uri,
    member_count: g.member_count,
    confidence: g.confidence,
  }
}

function rawToCard(v: Record<string, unknown>): VenueCard {
  const name = typeof v['name'] === 'string' && v['name'] ? v['name'] : 'Tennis Court'
  return {
    id: v['id'] as string,
    osm_id: (v['osm_id'] as string | null) ?? null,
    name,
    kind: 'unknown',
    lat: v['lat'] as number,
    lng: v['lng'] as number,
    address: (v['address'] as string | null) ?? null,
    surface: (v['surface'] as string | null) ?? null,
    court_count: typeof v['court_count'] === 'number' ? v['court_count'] : 1,
    lit: (v['lit'] as boolean | null) ?? null,
    access: (v['access'] as string | null) ?? null,
    fee: (v['fee'] as boolean | null) ?? null,
    website: (v['website'] as string | null) ?? null,
    phone: (v['phone'] as string | null) ?? null,
    operator: (v['operator'] as string | null) ?? null,
    opening_hours: (v['opening_hours'] as string | null) ?? null,
    description: (v['description'] as string | null) ?? null,
    has_indoor: (v['has_indoor'] as boolean | null) ?? null,
    has_outdoor: (v['has_outdoor'] as boolean | null) ?? null,
    google_maps_uri: null,
    member_count: 1,
    confidence: 'low',
  }
}

/** Score a card by data richness — higher = becomes the representative when clustering */
function cardScore(v: VenueCard): number {
  return (
    (v.name !== 'Tennis Court' && v.name !== 'Tennis Courts' ? 20 : 0) +
    (v.phone ? 10 : 0) +
    (v.website ? 10 : 0) +
    (v.description ? 5 : 0) +
    (v.court_count ?? 0)
  )
}

/**
 * Runtime fallback for courts that the catalog pipeline has not grouped yet:
 * merge courts within CLUSTER_RADIUS_M into one card and sum their court counts.
 */
function clusterUngrouped(cards: VenueCard[]): VenueCard[] {
  const sorted = [...cards].sort((a, b) => cardScore(b) - cardScore(a))
  const result: VenueCard[] = []

  for (const card of sorted) {
    const existing = result.find((r) => haversineKm(card.lat, card.lng, r.lat, r.lng) * 1000 < CLUSTER_RADIUS_M)
    if (existing) {
      existing.court_count = (existing.court_count ?? 0) + (card.court_count ?? 1)
      existing.member_count += 1
    } else {
      result.push({ ...card })
    }
  }
  return result
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl

  // Accept either explicit bbox or lat/lng/radius
  let south: number, west: number, north: number, east: number

  const southParam = searchParams.get('south')
  const westParam = searchParams.get('west')
  const northParam = searchParams.get('north')
  const eastParam = searchParams.get('east')

  if (southParam && westParam && northParam && eastParam) {
    south = parseFloat(southParam)
    west = parseFloat(westParam)
    north = parseFloat(northParam)
    east = parseFloat(eastParam)
    if ([south, west, north, east].some(isNaN)) {
      return NextResponse.json({ error: 'Invalid bbox params' }, { status: 400 })
    }
    // Cap the box so one request cannot scan a whole region.
    const centerLat = (south + north) / 2
    const centerLng = (west + east) / 2
    const MAX_KM = 25
    const capped = boundingBox(centerLat, centerLng, MAX_KM)
    south = Math.max(south, capped.south)
    north = Math.min(north, capped.north)
    west = Math.max(west, capped.west)
    east = Math.min(east, capped.east)
  } else {
    const latParam = searchParams.get('lat')
    const lngParam = searchParams.get('lng')
    const radiusParam = searchParams.get('radius')
    if (!latParam || !lngParam) {
      return NextResponse.json({ error: 'lat and lng are required' }, { status: 400 })
    }
    const lat = parseFloat(latParam)
    const lng = parseFloat(lngParam)
    const radiusKm = Math.min(MAX_RADIUS_KM, Math.max(1, radiusParam ? parseFloat(radiusParam) : 10))
    if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
      return NextResponse.json({ error: 'Invalid lat/lng/radius' }, { status: 400 })
    }
    ;({ south, west, north, east } = boundingBox(lat, lng, radiusKm))
  }
  const supabase = await createClient()

  // Catalog is filled by the venue scripts. This route only reads it.
  const [groupsResult, ungroupedResult] = await Promise.all([
    supabase
      .from('venue_groups')
      .select('id, name, kind, lat, lng, address, phone, website, opening_hours, description, court_count, court_count_osm, member_count, surface, lit, has_indoor, has_outdoor, access, fee, google_maps_uri, confidence')
      .gte('lat', south)
      .lte('lat', north)
      .gte('lng', west)
      .lte('lng', east)
      .limit(QUERY_CAP),
    supabase
      .from('venues')
      .select('id, osm_id, name, lat, lng, address, surface, court_count, lit, access, fee, website, phone, operator, opening_hours, description, has_indoor, has_outdoor')
      .is('group_id', null)
      .gte('lat', south)
      .lte('lat', north)
      .gte('lng', west)
      .lte('lng', east)
      .limit(QUERY_CAP),
  ])

  if (ungroupedResult.error) {
    console.error('Venues query error:', ungroupedResult.error)
    return NextResponse.json({ venues: [], total: 0, hasMore: false })
  }
  if (groupsResult.error) {
    // Migration 037 not applied yet → degrade gracefully to raw clustering
    console.error('Venue groups query error:', groupsResult.error)
  }

  const groupCards = ((groupsResult.data ?? []) as GroupRow[]).map(groupToCard)
  const rawCards = clusterUngrouped((ungroupedResult.data ?? []).map(rawToCard))

  const offsetParam = searchParams.get('offset')
  const offset = offsetParam ? Math.max(0, parseInt(offsetParam, 10)) : 0
  const includePrivate = searchParams.get('include_private') === '1'

  const centerLat = (south + north) / 2
  const centerLng = (west + east) / 2
  const sorted = [...groupCards, ...rawCards]
    .filter((c) => includePrivate || c.kind !== 'residential')
    .sort(
      (a, b) =>
        haversineKm(centerLat, centerLng, a.lat, a.lng) - haversineKm(centerLat, centerLng, b.lat, b.lng),
    )
  const total = sorted.length
  const venues = sorted.slice(offset, offset + MAX_RESULTS)

  return NextResponse.json({
    venues,
    total,
    hasMore: offset + MAX_RESULTS < total,
  })
}
