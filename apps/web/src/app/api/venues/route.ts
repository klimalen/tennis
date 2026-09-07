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
  const query = `[out:json][timeout:25];
(
  way["leisure"="pitch"]["sport"="tennis"](${south},${west},${north},${east});
  node["leisure"="pitch"]["sport"="tennis"](${south},${west},${north},${east});
);
out center tags;`

  const res = await fetch('https://overpass-api.de/api/interpreter', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: `data=${encodeURIComponent(query)}`,
    signal: AbortSignal.timeout(30_000),
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

  const { south, west, north, east } = boundingBox(lat, lng, radiusKm)
  const supabase = await createClient()

  // Check if we have recent data for this area (any venue within bbox fetched in last 30 days)
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
      const venues = await fetchFromOverpass(south, west, north, east)
      if (venues.length > 0) {
        const { error: upsertError } = await supabase
          .from('venues')
          .upsert(venues, { onConflict: 'osm_id', ignoreDuplicates: false })
        if (upsertError) {
          console.error('Venues upsert error:', upsertError)
        }
      }
    } catch (err) {
      console.error('Overpass fetch failed, returning cached data:', err)
    }
  }

  // Return all venues within the bounding box
  const { data: venues, error: queryError } = await supabase
    .from('venues')
    .select('*')
    .gte('lat', south)
    .lte('lat', north)
    .gte('lng', west)
    .lte('lng', east)
    .order('name')

  if (queryError) {
    console.error('Venues query error:', queryError)
    return NextResponse.json({ venues: [] })
  }

  return NextResponse.json({ venues: venues ?? [] })
}
