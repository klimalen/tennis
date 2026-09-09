import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

interface OverpassTags {
  name?: string
  'name:en'?: string
  surface?: string
  lit?: string
  access?: string
  fee?: string
  website?: string
  url?: string
  phone?: string
  'contact:phone'?: string
  operator?: string
  opening_hours?: string
  courts?: string
  'addr:street'?: string
  'addr:city'?: string
}

interface OverpassElement {
  type: 'way' | 'node'
  id: number
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags: OverpassTags
}

interface OverpassResponse {
  elements: OverpassElement[]
}

interface VenueUpsert {
  osm_id: string
  name: string
  lat: number
  lng: number
  address: string | null
  surface: string | null
  court_count: number | null
  lit: boolean
  access: string | null
  fee: boolean | null
  website: string | null
  phone: string | null
  operator: string | null
  opening_hours: string | null
  osm_fetched_at: string
}

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

// If we already have this many venues in the bbox, skip Overpass entirely
const CATALOG_SUFFICIENT_COUNT = 50
// Max venues to return to the client
const MAX_RESULTS = 20
// Venues within this radius (metres) are considered the same physical location
const CLUSTER_RADIUS_M = 250

/** Score a venue by data richness — higher = show this one when clustering */
function venueScore(v: Record<string, unknown>): number {
  return (
    (v['name'] && v['name'] !== 'Tennis Court' ? 20 : 0) +
    (v['phone'] ? 10 : 0) +
    (v['website'] ? 10 : 0) +
    (v['description'] ? 5 : 0) +
    (typeof v['court_count'] === 'number' ? v['court_count'] : 0)
  )
}

/**
 * Cluster nearby courts into single venue cards.
 * Unnamed courts within CLUSTER_RADIUS_M of a named/better venue are merged:
 * their court counts are summed and they are dropped from the result.
 */
function clusterVenues(venues: Record<string, unknown>[]): Record<string, unknown>[] {
  // Sort best-scored first so the "representative" venue wins ties
  const sorted = [...venues].sort((a, b) => venueScore(b) - venueScore(a))
  const result: Record<string, unknown>[] = []

  for (const venue of sorted) {
    const vLat = venue['lat'] as number
    const vLng = venue['lng'] as number

    const existingCluster = result.find((r) => {
      const rLat = r['lat'] as number
      const rLng = r['lng'] as number
      return haversineKm(vLat, vLng, rLat, rLng) * 1000 < CLUSTER_RADIUS_M
    })

    if (existingCluster) {
      // Merge court count from this venue into the cluster representative
      const existingCount = typeof existingCluster['court_count'] === 'number'
        ? existingCluster['court_count']
        : 0
      const incomingCount = typeof venue['court_count'] === 'number'
        ? venue['court_count']
        : 1   // each individual pitch = 1 court
      existingCluster['court_count'] = existingCount + incomingCount
    } else {
      // New cluster — ensure unnamed single courts show court_count = 1
      if (venue['court_count'] == null) {
        result.push({ ...venue, court_count: 1 })
      } else {
        result.push({ ...venue })
      }
    }
  }

  return result
}

function parseElement(el: OverpassElement): VenueUpsert | null {
  const lat = el.type === 'node' ? el.lat : el.center?.lat
  const lng = el.type === 'node' ? el.lon : el.center?.lon
  if (lat == null || lng == null) return null

  const tags = el.tags ?? {}
  const feeRaw = tags.fee
  const fee: boolean | null =
    feeRaw === 'yes' ? true : feeRaw === 'no' ? false : null

  const addressParts = [tags['addr:street'], tags['addr:city']].filter(Boolean)
  const address = addressParts.length > 0 ? addressParts.join(', ') : null

  return {
    osm_id: `${el.type}/${el.id}`,
    name: tags.name ?? tags['name:en'] ?? 'Tennis Court',
    lat,
    lng,
    address,
    surface: tags.surface ?? null,
    court_count: tags.courts ? parseInt(tags.courts, 10) : null,
    lit: tags.lit === 'yes',
    access: tags.access ?? null,
    fee,
    website: tags.website ?? tags.url ?? null,
    phone: tags.phone ?? tags['contact:phone'] ?? null,
    operator: tags.operator ?? null,
    opening_hours: tags.opening_hours ?? null,
    osm_fetched_at: new Date().toISOString(),
  }
}

async function fetchFromOverpass(
  south: number,
  west: number,
  north: number,
  east: number,
): Promise<VenueUpsert[]> {
  const query = `[out:json][timeout:40];
(
  way["leisure"="pitch"]["sport"="tennis"](${south},${west},${north},${east});
  node["leisure"="pitch"]["sport"="tennis"](${south},${west},${north},${east});
);
out center tags;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'User-Agent': 'TennisApp/1.0 (tennis-finder; contact@tennisapp.com)',
    },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(45_000),
  })

  if (!res.ok) {
    throw new Error(`Overpass returned ${res.status}`)
  }

  const json: OverpassResponse = await res.json()
  return json.elements.flatMap((el) => {
    const v = parseElement(el)
    return v ? [v] : []
  })
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
    // Cap bbox to ~25 km radius to avoid Overpass timeouts on large cities
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
    const radiusKm = radiusParam ? parseFloat(radiusParam) : 10
    if (isNaN(lat) || isNaN(lng) || isNaN(radiusKm)) {
      return NextResponse.json({ error: 'Invalid lat/lng/radius' }, { status: 400 })
    }
    ;({ south, west, north, east } = boundingBox(lat, lng, radiusKm))
  }
  const supabase = await createClient()

  // Check how many venues we already have in this area
  const { count: existingCount } = await supabase
    .from('venues')
    .select('*', { count: 'exact', head: true })
    .gte('lat', south)
    .lte('lat', north)
    .gte('lng', west)
    .lte('lng', east)

  const catalogSufficient = (existingCount ?? 0) >= CATALOG_SUFFICIENT_COUNT

  let overpassCount = 0
  let overpassError: string | null = null

  if (!catalogSufficient) {
    // Fall back to Overpass for cities without a pre-populated catalog
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentCheck } = await supabase
      .from('venues')
      .select('id')
      .gte('lat', south)
      .lte('lat', north)
      .gte('lng', west)
      .lte('lng', east)
      .gte('osm_fetched_at', thirtyDaysAgo)
      .limit(1)

    const isStale = !recentCheck || recentCheck.length === 0

    if (isStale) {
      try {
        const fetched = await fetchFromOverpass(south, west, north, east)
        overpassCount = fetched.length
        if (fetched.length > 0) {
          const { error: upsertError } = await supabase
            .from('venues')
            .upsert(fetched, { onConflict: 'osm_id', ignoreDuplicates: false })
          if (upsertError) {
            console.error('Venues upsert error:', upsertError)
            overpassError = upsertError.message
          }
        }
      } catch (err) {
        const msg = err instanceof Error ? err.message : String(err)
        console.error('Overpass fetch failed:', msg)
        overpassError = msg
      }
    }
  }

  // Fetch venues from DB, then sort by distance and limit
  const { data: allVenues, error: queryError } = await supabase
    .from('venues')
    .select('*')
    .gte('lat', south)
    .lte('lat', north)
    .gte('lng', west)
    .lte('lng', east)

  if (queryError) {
    console.error('Venues query error:', queryError)
    return NextResponse.json({ venues: [], _debug: { overpassError, queryError: queryError.message } })
  }

  // Cluster nearby courts, sort by distance, return nearest MAX_RESULTS
  const centerLat = (south + north) / 2
  const centerLng = (west + east) / 2
  const clustered = clusterVenues(allVenues ?? [])
  const venues = clustered
    .sort(
      (a, b) =>
        haversineKm(centerLat, centerLng, a['lat'] as number, a['lng'] as number) -
        haversineKm(centerLat, centerLng, b['lat'] as number, b['lng'] as number),
    )
    .slice(0, MAX_RESULTS)

  return NextResponse.json({
    venues,
    _debug: { catalogSufficient, existingCount, overpassCount, overpassError, bbox: { south, west, north, east } },
  })
}
