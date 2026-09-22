/**
 * Enclosing-feature lookup: "which named OSM polygon contains this court?"
 *
 * Courts are almost always drawn inside a park, school, sports centre, club or
 * residential complex polygon that carries a name (and sometimes website / phone /
 * opening hours). One bulk Overpass request per city, then point-in-polygon locally,
 * so we don't depend on hundreds of flaky per-point requests.
 */

import {
  type BBox,
  bboxAreaM2,
  haversineM,
  kindFromOsmTags,
  pointInRing,
  readJsonCache,
  sleep,
  type VenueKind,
  writeJsonCache,
} from './venue-common'

// ─── Overpass ─────────────────────────────────────────────────────────────────

const OVERPASS_ENDPOINTS = [
  'https://overpass-api.de/api/interpreter',
  'https://overpass.private.coffee/api/interpreter',
  'https://overpass.kumi.systems/api/interpreter',
]

interface OverpassBounds {
  minlat: number
  minlon: number
  maxlat: number
  maxlon: number
}

interface OverpassElement {
  type: 'way' | 'relation' | 'node'
  id: number
  bounds?: OverpassBounds
  geometry?: { lat: number; lon: number }[]
  tags?: Record<string, string>
}

export async function overpass(query: string, timeoutMs = 200_000): Promise<{ elements: OverpassElement[] }> {
  let lastErr: unknown = null
  for (let attempt = 0; attempt < 2; attempt++) {
    for (const endpoint of OVERPASS_ENDPOINTS) {
      try {
        process.stdout.write(`   overpass → ${new URL(endpoint).host}… `)
        const res = await fetch(endpoint, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'User-Agent': 'TennisApp/1.0 (catalog-builder; contact@tennisapp.com)',
          },
          body: `data=${encodeURIComponent(query)}`,
          signal: AbortSignal.timeout(timeoutMs),
        })
        if (!res.ok) {
          console.log(`HTTP ${res.status}`)
          lastErr = new Error(`Overpass ${res.status}`)
          continue
        }
        const json = (await res.json()) as { elements: OverpassElement[] }
        console.log(`ok (${json.elements.length} elements)`)
        return json
      } catch (e) {
        console.log(e instanceof Error ? e.message : String(e))
        lastErr = e
      }
    }
    await sleep(5_000)
  }
  throw lastErr instanceof Error ? lastErr : new Error('All Overpass endpoints failed')
}

// ─── Candidate parents ────────────────────────────────────────────────────────

const PARENT_FILTERS = [
  `["name"]["leisure"~"^(park|sports_centre|recreation_ground|stadium|golf_course|fitness_centre|resort|nature_reserve)$"]`,
  `["name"]["amenity"~"^(school|college|university|community_centre|club|social_facility|place_of_worship)$"]`,
  `["name"]["club"]`,
  `["name"]["landuse"~"^(recreation_ground|residential|retail|commercial)$"]`,
  `["name"]["tourism"~"^(hotel|resort|apartment|camp_site)$"]`,
  `["name"]["building"~"^(apartments|dormitory|hotel)$"]`,
  `["name"]["sport"="tennis"]["leisure"!="pitch"]`,
]

function buildParentsQuery(b: BBox): string {
  const bbox = `(${b.south},${b.west},${b.north},${b.east})`
  const ways = PARENT_FILTERS.map((f) => `  way${f}${bbox};`).join('\n')
  const rels = PARENT_FILTERS.map((f) => `  relation${f}${bbox};`).join('\n')
  return `[out:json][timeout:180];
(
${ways}
)->.w;
(
${rels}
)->.r;
.w out tags geom;
.r out tags bb;`
}

export interface ParentFeature {
  osmId: string // "way/123" | "relation/456"
  name: string
  kind: VenueKind
  tags: Record<string, string>
  bounds: OverpassBounds
  areaM2: number
  ring: [number, number][] | null // [lat, lng][]; null for relations (bbox only)
  center: { lat: number; lng: number }
}

export interface ParentIndex {
  features: ParentFeature[]
  fetchedAt: string
}

// Anything bigger than this is a neighbourhood / district, not a facility.
const MAX_PARENT_AREA_M2 = 12_000_000 // 12 km²

export async function loadParentIndex(city: { slug: string; bbox: BBox }, opts: { noCache?: boolean } = {}): Promise<ParentIndex> {
  const cacheFile = `osm-parents-${city.slug}.json`
  const cached = opts.noCache ? null : readJsonCache<{ elements: OverpassElement[]; fetchedAt: string }>(cacheFile, 14 * 24 * 3600 * 1000)

  let elements: OverpassElement[]
  let fetchedAt: string
  if (cached) {
    console.log('   (using cached OSM parents — pass --no-cache to refresh)')
    elements = cached.elements
    fetchedAt = cached.fetchedAt
  } else {
    const json = await overpass(buildParentsQuery(city.bbox))
    fetchedAt = new Date().toISOString()
    writeJsonCache(cacheFile, { elements: json.elements, fetchedAt })
    elements = json.elements
  }

  const features: ParentFeature[] = []
  for (const el of elements) {
    const tags = el.tags ?? {}
    const name = tags['name']
    if (!name) continue
    // Skip admin/timezone/place areas that sneak in via the "club" or "name" filters
    if (tags['boundary'] || tags['place'] || tags['admin_level'] || tags['timezone']) continue

    let bounds = el.bounds
    let ring: [number, number][] | null = null
    if (el.type === 'way' && el.geometry && el.geometry.length >= 4) {
      ring = el.geometry.map((p) => [p.lat, p.lon] as [number, number])
      if (!bounds) {
        const lats = ring.map((p) => p[0])
        const lons = ring.map((p) => p[1])
        bounds = { minlat: Math.min(...lats), maxlat: Math.max(...lats), minlon: Math.min(...lons), maxlon: Math.max(...lons) }
      }
    }
    if (!bounds) continue
    const areaM2 = bboxAreaM2(bounds)
    if (areaM2 > MAX_PARENT_AREA_M2 || areaM2 < 200) continue

    features.push({
      osmId: `${el.type}/${el.id}`,
      name,
      kind: kindFromOsmTags(tags),
      tags,
      bounds,
      areaM2,
      ring,
      center: { lat: (bounds.minlat + bounds.maxlat) / 2, lng: (bounds.minlon + bounds.maxlon) / 2 },
    })
  }

  return { features, fetchedAt }
}

// ─── Lookup ───────────────────────────────────────────────────────────────────

export interface ParentMatch {
  feature: ParentFeature
  /** 'inside' = point inside polygon; 'bbox' = inside bbox only (relation); 'near' = within NEAR_M of polygon centre */
  how: 'inside' | 'bbox' | 'near'
}

const NEAR_M = 80

/**
 * Find the most specific named feature containing the point.
 * Preference: smallest polygon that truly contains the point; then smallest bbox
 * (relations); then a small feature whose centre is within NEAR_M.
 */
export function findParent(index: ParentIndex, lat: number, lng: number): ParentMatch | null {
  let bestInside: ParentFeature | null = null
  let bestBbox: ParentFeature | null = null

  for (const f of index.features) {
    const b = f.bounds
    if (lat < b.minlat || lat > b.maxlat || lng < b.minlon || lng > b.maxlon) continue
    if (f.ring) {
      if (pointInRing(lat, lng, f.ring)) {
        if (!bestInside || f.areaM2 < bestInside.areaM2) bestInside = f
      }
    } else if (!bestBbox || f.areaM2 < bestBbox.areaM2) {
      bestBbox = f
    }
  }

  if (bestInside) return { feature: bestInside, how: 'inside' }
  // A relation bbox is a weaker signal — only trust it when it is reasonably small
  if (bestBbox && bestBbox.areaM2 < 2_000_000) return { feature: bestBbox, how: 'bbox' }

  // Fallback: small named feature right next to the courts (e.g. a clubhouse polygon)
  let near: ParentFeature | null = null
  let nearD = Infinity
  for (const f of index.features) {
    if (f.areaM2 > 60_000) continue
    const d = haversineM(lat, lng, f.center.lat, f.center.lng)
    if (d < NEAR_M && d < nearD) {
      nearD = d
      near = f
    }
  }
  return near ? { feature: near, how: 'near' } : null
}

/** Human-readable contact fields carried by the parent feature itself. */
export function contactsFromTags(tags: Record<string, string>) {
  return {
    website: tags['website'] ?? tags['contact:website'] ?? tags['url'] ?? null,
    phone: tags['phone'] ?? tags['contact:phone'] ?? null,
    opening_hours: tags['opening_hours'] ?? null,
    operator: tags['operator'] ?? null,
    address: buildAddress(tags),
  }
}

function buildAddress(tags: Record<string, string>): string | null {
  const street = tags['addr:housenumber'] && tags['addr:street']
    ? `${tags['addr:housenumber']} ${tags['addr:street']}`
    : tags['addr:street']
  const parts = [street, tags['addr:city'], tags['addr:postcode']].filter(Boolean)
  return parts.length ? parts.join(', ') : null
}
