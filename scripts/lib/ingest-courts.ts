/**
 * Load raw tennis-court geometries for a city into `venues`.
 *
 * OpenStreetMap is the base layer (one row per court polygon). Geoapify fills
 * clubs that were never drawn, when GEOAPIFY_API_KEY is set. Austin also pulls
 * the city open-data tennis centers. Later steps (`venues cluster` / `identify`)
 * turn these rows into organization cards.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

import { overpass } from './osm-parents'
import {
  bboxAreaM2,
  type CityConfig,
  haversineM,
  hasCyrillic,
  preferredOsmName,
  readJsonCache,
  serbianToLatin,
  type SourceRef,
  tidyPostalAddress,
  supabaseAdmin,
  writeJsonCache,
} from './venue-common'

const DEDUP_RADIUS_M = 150
const MIN_AREA_M2 = 150
/** A single pitch polygon bigger than this is a park drawn as one court. */
const MAX_PITCH_AREA_M2 = 25_000
/** A sports centre / stadium bigger than this is a campus, not a facility. */
const MAX_FACILITY_AREA_M2 = 800_000
const TENNIS_SPORT = /(^|;)tennis(;|$)/i
/** Racquet sports that can share a clubhouse with tennis. A hall that also lists soccer or basketball is not a tennis facility. */
const RACQUET_SPORTS = new Set(['tennis', 'padel', 'squash', 'racquet', 'badminton'])

function sportList(tags: Record<string, string>): string[] {
  return (tags['sport'] ?? '').split(';').map((s) => s.trim().toLowerCase()).filter(Boolean)
}

/** Pitches tagged tennis are courts. A sports centre is a tennis facility only when every listed sport is a racquet sport. */
function isTennisFacility(tags: Record<string, string>): boolean {
  const sports = sportList(tags)
  if (!sports.includes('tennis')) return false
  if ((tags['leisure'] ?? 'pitch') === 'pitch') return true
  return sports.every((s) => RACQUET_SPORTS.has(s))
}

export interface IngestVenue {
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
  sources: SourceRef[]
  needs_enrichment: boolean
  osm_fetched_at: string
}

interface CourtElement {
  type: 'way' | 'node' | 'relation'
  id: number
  bounds?: { minlat: number; minlon: number; maxlat: number; maxlon: number }
  lat?: number
  lon?: number
  center?: { lat: number; lon: number }
  tags?: Record<string, string>
}

function courtsQuery(city: CityConfig): string {
  const { south, west, north, east } = city.bbox
  const box = `(${south},${west},${north},${east})`
  const sport = `["sport"~"(^|;)tennis(;|$)"]`
  return `[out:json][timeout:90];
(
  way["leisure"="pitch"]${sport}${box};
  node["leisure"="pitch"]${sport}${box};
  way["leisure"="sports_centre"]${sport}${box};
  node["leisure"="sports_centre"]${sport}${box};
  relation["leisure"="sports_centre"]${sport}${box};
  way["leisure"="stadium"]${sport}${box};
  relation["leisure"="stadium"]${sport}${box};
);
out center bb tags;`
}

function parseCourt(el: CourtElement, fetchedAt: string, rejected: { id: string; reason: string }[]): IngestVenue | null {
  const tags = el.tags ?? {}
  if (!isTennisFacility(tags)) {
    if (TENNIS_SPORT.test(tags['sport'] ?? '')) {
      rejected.push({ id: `${el.type}/${el.id}`, reason: `multi-sport facility, not a tennis club (${tags['sport']})` })
    }
    return null
  }
  if (tags['leisure'] === 'pitch' && tags['surface'] === 'sand') {
    rejected.push({ id: `${el.type}/${el.id}`, reason: 'surface=sand (not a tennis court)' })
    return null
  }

  // Some Overpass mirrors omit `center` even when asked. The bounding-box
  // midpoint is the same point `out center` would have returned.
  const lat = el.type === 'node' ? el.lat : (el.center?.lat ?? (el.bounds ? (el.bounds.minlat + el.bounds.maxlat) / 2 : undefined))
  const lng = el.type === 'node' ? el.lon : (el.center?.lon ?? (el.bounds ? (el.bounds.minlon + el.bounds.maxlon) / 2 : undefined))
  if (lat == null || lng == null) return null

  const leisure = tags['leisure']
  if (el.bounds) {
    const area = bboxAreaM2(el.bounds)
    const max = leisure === 'pitch' ? MAX_PITCH_AREA_M2 : MAX_FACILITY_AREA_M2
    if (area < MIN_AREA_M2) {
      rejected.push({ id: `${el.type}/${el.id}`, reason: `area too small: ${Math.round(area)} m²` })
      return null
    }
    if (area > max) {
      rejected.push({ id: `${el.type}/${el.id}`, reason: `area too large: ${Math.round(area)} m²` })
      return null
    }
  }

  const fee = tags['fee'] === 'yes' ? true : tags['fee'] === 'no' ? false : null
  const streetRaw = tags['addr:housenumber'] && tags['addr:street'] ? `${tags['addr:housenumber']} ${tags['addr:street']}` : tags['addr:street']
  const place = (value: string | undefined) => (value && hasCyrillic(value) ? serbianToLatin(value) : value)
  const addrParts = [place(streetRaw), place(tags['addr:city']), tags['addr:postcode']].filter(Boolean)
  const website = tags['website'] ?? tags['contact:website'] ?? tags['url'] ?? null
  const phone = tags['phone'] ?? tags['contact:phone'] ?? null
  const hasIndoor = tags['indoor'] === 'yes' ? true : tags['indoor'] === 'no' ? false : null
  const courts = tags['courts'] ? Number.parseInt(tags['courts'], 10) : null

  return {
    osm_id: `${el.type}/${el.id}`,
    name: preferredOsmName(tags) ?? 'Tennis Court',
    lat,
    lng,
    address: tidyPostalAddress(addrParts.length ? addrParts.join(', ') : null),
    surface: tags['surface'] ?? null,
    court_count: courts != null && Number.isFinite(courts) ? courts : null,
    lit: tags['lit'] === 'yes',
    access: tags['access'] ?? null,
    fee,
    website,
    phone,
    operator: place(tags['operator']) ?? null,
    opening_hours: tags['opening_hours'] ?? null,
    description: null,
    has_indoor: hasIndoor,
    has_outdoor: hasIndoor === true ? null : true,
    sources: [{ type: 'osm', url: `https://www.openstreetmap.org/${el.type}/${el.id}`, fetched_at: fetchedAt }],
    needs_enrichment: !phone && !website,
    osm_fetched_at: fetchedAt,
  }
}

async function fetchOsm(city: CityConfig, noCache: boolean): Promise<{ venues: IngestVenue[]; rejected: number; raw: number }> {
  console.log('→ Fetching OpenStreetMap via Overpass…')
  const cacheFile = `overpass-courts-${city.slug}.json`
  const cached = noCache ? null : readJsonCache<{ elements: CourtElement[] }>(cacheFile, 7 * 24 * 3600 * 1000)
  const now = new Date().toISOString()
  const rejected: { id: string; reason: string }[] = []

  let elements: CourtElement[]
  if (cached) {
    console.log('   (using cached Overpass response — pass --no-cache to refresh)')
    elements = cached.elements
  } else {
    const json = await overpass(courtsQuery(city), 120_000)
    elements = json.elements as CourtElement[]
    writeJsonCache(cacheFile, { elements })
  }

  const venues: IngestVenue[] = []
  for (const el of elements) {
    const row = parseCourt(el, now, rejected)
    if (row) venues.push(row)
  }
  console.log(`   ${elements.length} raw → ${venues.length} valid, ${rejected.length} rejected`)
  for (const r of rejected.slice(0, 5)) console.log(`     ${r.id}: ${r.reason}`)
  return { venues, rejected: rejected.length, raw: elements.length }
}

async function fetchGeoapify(city: CityConfig): Promise<IngestVenue[]> {
  const apiKey = process.env['GEOAPIFY_API_KEY']
  if (!apiKey) {
    console.log('→ Geoapify: skipped (no GEOAPIFY_API_KEY)')
    return []
  }

  console.log('→ Fetching Geoapify Places (tennis)…')
  const { south, west, north, east } = city.bbox
  const url = new URL('https://api.geoapify.com/v2/places')
  url.searchParams.set('categories', 'sport.tennis')
  url.searchParams.set('filter', `rect:${west},${south},${east},${north}`)
  url.searchParams.set('limit', '500')
  url.searchParams.set('apiKey', apiKey)

  const res = await fetch(url, { headers: { 'User-Agent': 'TennisApp/1.0 (catalog-builder)' } })
  if (!res.ok) throw new Error(`Geoapify returned ${res.status}`)
  const json = (await res.json()) as {
    features: { properties: { place_id?: string; name?: string; formatted?: string; address_line1?: string; lat: number; lon: number; phone?: string; website?: string; opening_hours?: string; datasource?: { url?: string } } }[]
  }
  const now = new Date().toISOString()
  const venues: IngestVenue[] = []
  for (const f of json.features) {
    const p = f.properties
    if (!p.lat || !p.lon) continue
    const website = p.website ?? null
    const phone = p.phone ?? null
    venues.push({
      osm_id: `geoapify:${p.place_id ?? `${p.lat}-${p.lon}`}`,
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
      sources: [{ type: 'geoapify', url: p.datasource?.url, fetched_at: now }],
      needs_enrichment: !phone && !website,
      osm_fetched_at: now,
    })
  }
  console.log(`   Found ${venues.length} Geoapify venues`)
  return venues
}

interface AustinOdRow {
  facility_name?: string
  location_name?: string
  address_1?: string
  city?: string
  state?: string
  zip?: string
  phone?: string
  latitude?: string
  longitude?: string
  location?: { latitude?: string; longitude?: string }
}

async function fetchAustinOpenData(): Promise<IngestVenue[]> {
  console.log('→ Fetching Austin Open Data tennis centers…')
  const url = 'https://data.austintexas.gov/resource/xz46-u7fx.json'
  const res = await fetch(url, { headers: { 'User-Agent': 'TennisApp/1.0 (catalog-builder)' } })
  if (!res.ok) {
    console.log(`   Austin OD returned ${res.status} — skipping`)
    return []
  }
  const rows = (await res.json()) as AustinOdRow[]
  const now = new Date().toISOString()
  const venues: IngestVenue[] = []
  for (let i = 0; i < rows.length; i++) {
    const row = rows[i]
    if (!row) continue
    const lat = Number.parseFloat(row.latitude ?? row.location?.latitude ?? '')
    const lng = Number.parseFloat(row.longitude ?? row.location?.longitude ?? '')
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) continue
    const name = [row.facility_name, row.location_name].filter(Boolean).join(' — ') || 'Austin Tennis Center'
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

function mergeSecondary(primary: IngestVenue[], incoming: IngestVenue[]): IngestVenue[] {
  const result = [...primary]
  for (const row of incoming) {
    let best: IngestVenue | null = null
    let bestDist = Infinity
    for (const existing of result) {
      const d = haversineM(row.lat, row.lng, existing.lat, existing.lng)
      if (d < DEDUP_RADIUS_M && d < bestDist) {
        bestDist = d
        best = existing
      }
    }
    if (!best) {
      result.push(row)
      continue
    }
    if (!best.phone && row.phone) best.phone = row.phone
    if (!best.website && row.website) best.website = row.website
    if (!best.address && row.address) best.address = row.address
    if (!best.operator && row.operator) best.operator = row.operator
    if (!best.opening_hours && row.opening_hours) best.opening_hours = row.opening_hours
    if (row.has_outdoor) best.has_outdoor = true
    best.sources.push(...row.sources)
    if (best.phone || best.website) best.needs_enrichment = false
    console.log(`   Merged [${row.sources[0]?.type}] "${row.name}" → "${best.name}" (${Math.round(bestDist)}m)`)
  }
  return result
}

async function upsertVenues(sb: SupabaseClient, rows: IngestVenue[]) {
  const BATCH = 200
  for (let i = 0; i < rows.length; i += BATCH) {
    const batch = rows.slice(i, i + BATCH)
    const { error } = await sb.from('venues').upsert(batch, { onConflict: 'osm_id', ignoreDuplicates: false })
    if (error) throw new Error(`Upsert error at batch ${i}: ${error.message}`)
    console.log(`   ${Math.min(i + BATCH, rows.length)} / ${rows.length}`)
  }
}

export async function ingestCourts(opts: { city: CityConfig; dryRun: boolean; noCache: boolean }): Promise<number> {
  const { city, dryRun, noCache } = opts
  console.log(`\n🎾 Court ingest: ${city.label}${dryRun ? ' [DRY RUN]' : ''}\n`)

  const osm = await fetchOsm(city, noCache)
  const extras = await Promise.all([fetchGeoapify(city), city.slug === 'austin' ? fetchAustinOpenData() : Promise.resolve([])])

  console.log(`\n→ Merging secondary sources within ${DEDUP_RADIUS_M}m of an OSM court…`)
  const merged = mergeSecondary(osm.venues, extras.flat())
  const named = merged.filter((v) => v.name !== 'Tennis Court').length

  console.log(`\n📊 Results:`)
  console.log(`   OSM raw:               ${osm.raw}`)
  console.log(`   Rejected:              ${osm.rejected}`)
  console.log(`   OSM valid:             ${osm.venues.length}`)
  console.log(`   After dedup:           ${merged.length}`)
  console.log(`   Named:                 ${named}`)
  console.log(`   With phone:            ${merged.filter((v) => v.phone).length}`)
  console.log(`   With website:          ${merged.filter((v) => v.website).length}`)

  if (dryRun) {
    console.log('\n[DRY RUN] Named sample:')
    console.log(JSON.stringify(merged.filter((v) => v.name !== 'Tennis Court').slice(0, 8), null, 2))
    return merged.length
  }

  console.log(`\n→ Upserting ${merged.length} venues…`)
  await upsertVenues(supabaseAdmin(), merged)
  console.log(`\n✅ ${merged.length} venues saved for ${city.label}.`)
  return merged.length
}
