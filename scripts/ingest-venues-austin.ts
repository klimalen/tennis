/**
 * Ingest tennis venues for Austin, TX into the Supabase catalog.
 *
 * Sources:
 *   1. OpenStreetMap via Overpass API — with area-based validation
 *   2. Geoapify Places API           — fills in private clubs missing from OSM
 *   3. Austin Open Data              — 5 official city tennis centers
 *
 * Validation:
 *   OSM ways come with a bounding box → we calculate approximate area.
 *   Anything < 150 m² is rejected (too small to be a real tennis court).
 *   A singles court is ~261 m², table tennis table is ~4 m².
 *
 * Deduplication:
 *   Venues from different sources within 150 m of each other → merged into one record.
 *   OSM id is preferred; Geoapify/Austin OD data fills missing fields.
 *
 * Usage:
 *   pnpm ingest:austin              # live run
 *   pnpm ingest:austin --dry-run    # print stats + sample, no DB writes
 *   pnpm ingest:austin --no-cache   # force fresh Overpass fetch
 *
 * Required env (auto-loaded from apps/web/.env.local):
 *   NEXT_PUBLIC_SUPABASE_URL
 *   SUPABASE_SERVICE_ROLE_KEY
 *
 * Optional env:
 *   GEOAPIFY_API_KEY  — if missing, Geoapify step is skipped
 */

import { createClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ─── Env ──────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))

function loadEnvLocal() {
  const envPath = path.join(__dirname, '..', 'apps', 'web', '.env.local')
  if (!fs.existsSync(envPath)) return
  for (const line of fs.readFileSync(envPath, 'utf-8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/)
    if (m) {
      const [, key, raw] = m
      if (key && raw !== undefined && !process.env[key])
        process.env[key] = raw.replace(/^["']|["']$/g, '')
    }
  }
}

loadEnvLocal()

function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

// ─── Config ───────────────────────────────────────────────────────────────────

const BBOX = { south: 30.05, west: -98.05, north: 30.60, east: -97.35 }
const DEDUP_RADIUS_M = 150

// A real tennis court is ~261 m² (singles) or ~319 m² (doubles).
// We use 150 m² as the minimum to be generous with imprecise OSM polygons.
// Anything smaller (table tennis, tiny misdrawn polygon) is rejected.
const MIN_COURT_AREA_M2 = 150

const DRY_RUN = process.argv.includes('--dry-run')
const NO_CACHE = process.argv.includes('--no-cache')

// ─── Types ────────────────────────────────────────────────────────────────────

interface Source {
  type: 'osm' | 'austin_open_data' | 'geoapify' | 'browser_agent'
  url?: string
  fetched_at: string
}

interface VenueRow {
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
  description: string | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  sources: Source[]
  needs_enrichment: boolean
  osm_fetched_at: string
}

// ─── Geo helpers ──────────────────────────────────────────────────────────────

function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

/** Approximate area of a bounding box in square metres */
function bboxAreaM2(bounds: {
  minlat: number
  minlon: number
  maxlat: number
  maxlon: number
}): number {
  const lat = (bounds.maxlat + bounds.minlat) / 2
  const dlat = (bounds.maxlat - bounds.minlat) * 111_320
  const dlng = (bounds.maxlon - bounds.minlon) * 111_320 * Math.cos((lat * Math.PI) / 180)
  return dlat * dlng
}

// ─── Source 1: OpenStreetMap via Overpass ─────────────────────────────────────

interface OverpassBounds {
  minlat: number
  minlon: number
  maxlat: number
  maxlon: number
}

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
  indoor?: string
  'addr:street'?: string
  'addr:housenumber'?: string
  'addr:city'?: string
  'addr:postcode'?: string
}

interface OverpassElement {
  type: 'way' | 'node' | 'relation'
  id: number
  bounds?: OverpassBounds      // present for ways when using "out bb"
  lat?: number                 // present for nodes
  lon?: number
  center?: { lat: number; lon: number }
  tags: OverpassTags
}

const OVERPASS_CACHE_PATH = path.join(__dirname, '.cache', 'overpass-austin.json')

function loadOverpassCache(): { elements: OverpassElement[] } | null {
  if (NO_CACHE) return null
  try {
    if (!fs.existsSync(OVERPASS_CACHE_PATH)) return null
    const ageMs = Date.now() - fs.statSync(OVERPASS_CACHE_PATH).mtimeMs
    if (ageMs > 7 * 24 * 60 * 60 * 1000) return null
    console.log('   (using cached Overpass response — pass --no-cache to refresh)')
    return JSON.parse(fs.readFileSync(OVERPASS_CACHE_PATH, 'utf-8')) as {
      elements: OverpassElement[]
    }
  } catch {
    return null
  }
}

function saveOverpassCache(data: { elements: OverpassElement[] }) {
  fs.mkdirSync(path.dirname(OVERPASS_CACHE_PATH), { recursive: true })
  fs.writeFileSync(OVERPASS_CACHE_PATH, JSON.stringify(data))
}

function parseOverpassElement(
  el: OverpassElement,
  fetchedAt: string,
  rejected: { id: string; reason: string }[],
): VenueRow | null {
  const lat = el.type === 'node' ? el.lat : el.center?.lat
  const lng = el.type === 'node' ? el.lon : el.center?.lon
  if (lat == null || lng == null) return null

  // ── Area validation ────────────────────────────────────────────────────────
  if (el.bounds) {
    const area = bboxAreaM2(el.bounds)
    if (area < MIN_COURT_AREA_M2) {
      rejected.push({
        id: `${el.type}/${el.id}`,
        reason: `area too small: ${Math.round(area)} m² (min ${MIN_COURT_AREA_M2} m²)`,
      })
      return null
    }
  }
  // Nodes have no size info — accept them but they're rare

  const tags = el.tags ?? {}
  const fee = tags.fee === 'yes' ? true : tags.fee === 'no' ? false : null

  const addrParts = [
    tags['addr:housenumber'] && tags['addr:street']
      ? `${tags['addr:housenumber']} ${tags['addr:street']}`
      : tags['addr:street'],
    tags['addr:city'],
    tags['addr:postcode'],
  ].filter(Boolean)

  const website = tags.website ?? tags.url ?? null
  const phone = tags.phone ?? tags['contact:phone'] ?? null
  const hasIndoor = tags.indoor === 'yes' ? true : tags.indoor === 'no' ? false : null

  return {
    osm_id: `${el.type}/${el.id}`,
    name: tags.name ?? tags['name:en'] ?? 'Tennis Court',
    lat,
    lng,
    address: addrParts.length ? addrParts.join(', ') : null,
    surface: tags.surface ?? null,
    court_count: tags.courts ? parseInt(tags.courts, 10) : null,
    lit: tags.lit === 'yes',
    access: tags.access ?? null,
    fee,
    website,
    phone,
    operator: tags.operator ?? null,
    opening_hours: tags.opening_hours ?? null,
    description: null,
    has_indoor: hasIndoor,
    has_outdoor: hasIndoor === true ? null : true,
    sources: [
      {
        type: 'osm',
        url: `https://www.openstreetmap.org/${el.type}/${el.id}`,
        fetched_at: fetchedAt,
      },
    ],
    needs_enrichment: !phone && !website,
    osm_fetched_at: fetchedAt,
  }
}

async function fetchOverpass(): Promise<{ venues: VenueRow[]; rejected: number }> {
  const { south, west, north, east } = BBOX
  console.log('→ Fetching OpenStreetMap via Overpass…')

  const cached = loadOverpassCache()
  const now = new Date().toISOString()
  const rejected: { id: string; reason: string }[] = []

  if (cached) {
    const venues: VenueRow[] = []
    for (const el of cached.elements) {
      const v = parseOverpassElement(el, now, rejected)
      if (v) venues.push(v)
    }
    console.log(
      `   ${venues.length} valid, ${rejected.length} rejected (area < ${MIN_COURT_AREA_M2} m²)`,
    )
    return { venues, rejected: rejected.length }
  }

  // "out center bb tags" returns center point + bounding box + tags for each element
  const query = `[out:json][timeout:60];
(
  way["leisure"="pitch"]["sport"="tennis"](${south},${west},${north},${east});
  node["leisure"="pitch"]["sport"="tennis"](${south},${west},${north},${east});
  way["leisure"="sports_centre"]["sport"="tennis"](${south},${west},${north},${east});
  node["leisure"="sports_centre"]["sport"="tennis"](${south},${west},${north},${east});
  relation["leisure"="sports_centre"]["sport"="tennis"](${south},${west},${north},${east});
);
out center bb tags;`

  const endpoints = [
    'https://overpass-api.de/api/interpreter',
    'https://overpass.kumi.systems/api/interpreter',
  ]

  let res: Response | null = null
  for (const endpoint of endpoints) {
    try {
      console.log(`   Trying ${endpoint}…`)
      res = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'TennisApp/1.0 (catalog-builder; contact@tennisapp.com)',
        },
        body: `data=${encodeURIComponent(query)}`,
        signal: AbortSignal.timeout(65_000),
      })
      if (res.ok) break
      console.log(`   ${endpoint} → ${res.status}, trying next…`)
    } catch (e) {
      console.log(`   ${endpoint} failed: ${e instanceof Error ? e.message : e}`)
    }
  }

  if (!res?.ok) throw new Error('All Overpass endpoints failed')

  const json: { elements: OverpassElement[] } = await res.json()
  saveOverpassCache(json)

  const venues: VenueRow[] = []
  for (const el of json.elements) {
    const v = parseOverpassElement(el, now, rejected)
    if (v) venues.push(v)
  }

  console.log(
    `   ${json.elements.length} raw → ${venues.length} valid, ${rejected.length} rejected`,
  )
  if (rejected.length > 0) {
    console.log('   Sample rejections:')
    rejected.slice(0, 5).forEach((r) => console.log(`     ${r.id}: ${r.reason}`))
  }

  return { venues, rejected: rejected.length }
}

// ─── Source 2: Geoapify Places API ────────────────────────────────────────────

interface GeoapifyFeature {
  properties: {
    place_id?: string
    name?: string
    formatted?: string
    address_line1?: string
    lat: number
    lon: number
    phone?: string
    website?: string
    opening_hours?: string
    categories?: string[]
    datasource?: { sourcename?: string; url?: string }
  }
}

async function fetchGeoapify(): Promise<VenueRow[]> {
  const apiKey = process.env['GEOAPIFY_API_KEY']
  if (!apiKey) {
    console.log('→ Geoapify: skipped (no GEOAPIFY_API_KEY in env)')
    return []
  }

  console.log('→ Fetching Geoapify Places (tennis)…')

  const { south, west, north, east } = BBOX
  // Geoapify filter rect format: lon_min,lat_min,lon_max,lat_max
  const filter = `rect:${west},${south},${east},${north}`
  const url = new URL('https://api.geoapify.com/v2/places')
  url.searchParams.set('categories', 'sport.tennis')
  url.searchParams.set('filter', filter)
  url.searchParams.set('limit', '500')
  url.searchParams.set('apiKey', apiKey)

  const res = await fetch(url.toString(), {
    headers: { 'User-Agent': 'TennisApp/1.0 (catalog-builder)' },
  })
  if (!res.ok) throw new Error(`Geoapify returned ${res.status}`)

  const json: { features: GeoapifyFeature[] } = await res.json()
  const now = new Date().toISOString()

  const venues: VenueRow[] = []
  for (const f of json.features) {
    const p = f.properties
    if (!p.lat || !p.lon) continue

    const placeId = p.place_id ?? `geoapify-${p.lat}-${p.lon}`
    const website = p.website ?? null
    const phone = p.phone ?? null

    venues.push({
      osm_id: `geoapify:${placeId}`,
      name: p.name ?? 'Tennis Court',
      lat: p.lat,
      lng: p.lon,
      address: p.formatted ?? p.address_line1 ?? null,
      surface: null,
      court_count: null,
      lit: false,
      access: null,
      fee: null,
      website,
      phone,
      operator: null,
      opening_hours: p.opening_hours ?? null,
      description: null,
      has_indoor: null,
      has_outdoor: null,
      sources: [
        {
          type: 'geoapify',
          url: p.datasource?.url ?? url.toString(),
          fetched_at: now,
        },
      ],
      needs_enrichment: !phone && !website,
      osm_fetched_at: now,
    })
  }

  console.log(`   Found ${venues.length} Geoapify venues`)
  return venues
}

// ─── Source 3: Austin Open Data ───────────────────────────────────────────────

interface AustinODRow {
  facility_name?: string
  location_name?: string
  address_1?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  latitude?: string
  longitude?: string
  // sometimes Socrata returns location as nested object
  location?: { latitude?: string; longitude?: string; human_address?: string }
}

async function fetchAustinOpenData(): Promise<VenueRow[]> {
  console.log('→ Fetching Austin Open Data tennis centers…')

  const url = 'https://data.austintexas.gov/resource/xz46-u7fx.json'
  const res = await fetch(url, { headers: { 'User-Agent': 'TennisApp/1.0 (catalog-builder)' } })
  if (!res.ok) {
    console.log(`   Austin OD returned ${res.status} — skipping`)
    return []
  }

  const rows: AustinODRow[] = await res.json()
  const now = new Date().toISOString()
  const venues: VenueRow[] = []

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue

    // Socrata can nest coordinates inside a location object
    const latRaw = row.latitude ?? row.location?.latitude
    const lngRaw = row.longitude ?? row.location?.longitude
    const lat = parseFloat(latRaw ?? '')
    const lng = parseFloat(lngRaw ?? '')
    if (isNaN(lat) || isNaN(lng)) {
      console.log(`   Row ${i}: no coordinates — skipped`)
      continue
    }

    const name = [row.facility_name, row.location_name].filter(Boolean).join(' — ') ||
      'Austin Tennis Center'
    const address = [row.address_1, row.city, row.state, row.zip].filter(Boolean).join(', ') || null

    venues.push({
      osm_id: `austin_od:${i}`,
      name,
      lat,
      lng,
      address,
      surface: null,
      court_count: null,
      lit: false,
      access: 'public',
      fee: null,
      website: null,
      phone: row.phone ?? null,
      operator: 'City of Austin Parks and Recreation',
      opening_hours: null,
      description: null,
      has_indoor: null,
      has_outdoor: true,
      sources: [{ type: 'austin_open_data', url, fetched_at: now }],
      needs_enrichment: true,
      osm_fetched_at: now,
    })
  }

  console.log(`   Found ${venues.length} Austin OD venues`)
  return venues
}

// ─── Deduplication ────────────────────────────────────────────────────────────

/**
 * Merge all sources into a single list.
 * OSM records are the base (preferred id). When a secondary-source venue
 * is within DEDUP_RADIUS_M of an existing record, we enrich the existing
 * record with any missing fields rather than adding a duplicate.
 */
function mergeAll(primary: VenueRow[], ...rest: VenueRow[][]): VenueRow[] {
  const result: VenueRow[] = [...primary]

  for (const batch of rest) {
    for (const incoming of batch) {
      let bestMatch: VenueRow | null = null
      let bestDist = Infinity

      for (const existing of result) {
        const d = haversineM(incoming.lat, incoming.lng, existing.lat, existing.lng)
        if (d < DEDUP_RADIUS_M && d < bestDist) {
          bestDist = d
          bestMatch = existing
        }
      }

      if (bestMatch) {
        if (!bestMatch.phone && incoming.phone) bestMatch.phone = incoming.phone
        if (!bestMatch.website && incoming.website) bestMatch.website = incoming.website
        if (!bestMatch.address && incoming.address) bestMatch.address = incoming.address
        if (!bestMatch.operator && incoming.operator) bestMatch.operator = incoming.operator
        if (!bestMatch.opening_hours && incoming.opening_hours)
          bestMatch.opening_hours = incoming.opening_hours
        if (incoming.has_outdoor) bestMatch.has_outdoor = true
        bestMatch.sources.push(...incoming.sources)
        if (bestMatch.phone || bestMatch.website) bestMatch.needs_enrichment = false
        console.log(
          `   Merged [${incoming.sources[0]?.type}] "${incoming.name}" → "${bestMatch.name}" (${Math.round(bestDist)}m)`,
        )
      } else {
        result.push(incoming)
      }
    }
  }

  return result
}

// ─── Main ─────────────────────────────────────────────────────────────────────

async function main() {
  console.log(`\n🎾 Austin Venue Catalog Ingestion${DRY_RUN ? ' [DRY RUN]' : ''}\n`)

  const supabase = createClient(
    requireEnv('NEXT_PUBLIC_SUPABASE_URL'),
    requireEnv('SUPABASE_SERVICE_ROLE_KEY'),
  )

  const [{ venues: osmVenues, rejected }, geoapifyVenues, odVenues] = await Promise.all([
    fetchOverpass(),
    fetchGeoapify(),
    fetchAustinOpenData(),
  ])

  console.log(`\n→ Merging & deduplicating (threshold: ${DEDUP_RADIUS_M}m)…`)
  const merged = mergeAll(osmVenues, geoapifyVenues, odVenues)

  const withPhone = merged.filter((v) => v.phone).length
  const withWebsite = merged.filter((v) => v.website).length
  const needsEnrichment = merged.filter((v) => v.needs_enrichment).length
  const named = merged.filter((v) => v.name !== 'Tennis Court').length

  console.log(`\n📊 Results:`)
  console.log(`   OSM raw elements:      ${osmVenues.length + rejected}`)
  console.log(`   Rejected (too small):  ${rejected}`)
  console.log(`   OSM valid:             ${osmVenues.length}`)
  console.log(`   Geoapify:              ${geoapifyVenues.length}`)
  console.log(`   Austin Open Data:      ${odVenues.length}`)
  console.log(`   After dedup:           ${merged.length}`)
  console.log(`   Named venues:          ${named}`)
  console.log(`   Have phone:            ${withPhone}`)
  console.log(`   Have website:          ${withWebsite}`)
  console.log(`   Need enrichment:       ${needsEnrichment}`)

  if (DRY_RUN) {
    const namedSample = merged.filter((v) => v.name !== 'Tennis Court').slice(0, 5)
    console.log('\n[DRY RUN] Named venues sample:')
    console.log(JSON.stringify(namedSample, null, 2))
    return
  }

  console.log(`\n→ Upserting ${merged.length} venues to Supabase…`)

  // Upsert in batches of 200 to avoid payload limits
  const BATCH = 200
  for (let i = 0; i < merged.length; i += BATCH) {
    const batch = merged.slice(i, i + BATCH)
    const { error } = await supabase
      .from('venues')
      .upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false })
    if (error) {
      console.error(`❌ Upsert error at batch ${i}:`, error.message)
      process.exit(1)
    }
    console.log(`   ${Math.min(i + BATCH, merged.length)} / ${merged.length}`)
  }

  console.log(`\n✅ Done. ${merged.length} venues saved.`)
  console.log(`   ${needsEnrichment} flagged for browser agent enrichment.`)
}

main().catch((err) => {
  console.error('❌ Fatal error:', err)
  process.exit(1)
})
