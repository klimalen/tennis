/**
 * External place lookups by coordinates:
 *   - Google Places API (New): the organization at / next to a point
 *     (name, address, phone, website, hours, short description). Optional — needs
 *     GOOGLE_PLACES_API_KEY. Billing: one Text Search (Enterprise + Atmosphere SKU)
 *     per group, well inside the free monthly tier for a single city.
 *   - Nominatim reverse: postal address only. Never used as a venue name.
 */

import { haversineM, kindFromGoogleTypes, sleep, type VenueKind } from './venue-common'

// ─── Google Places (New) ──────────────────────────────────────────────────────

export interface GooglePlace {
  placeId: string
  name: string
  kind: VenueKind
  types: string[]
  address: string | null
  lat: number
  lng: number
  distanceM: number
  phone: string | null
  website: string | null
  openingHours: string | null
  description: string | null
  googleMapsUri: string | null
  businessStatus: string | null
}

interface RawPlace {
  id?: string
  displayName?: { text?: string }
  formattedAddress?: string
  shortFormattedAddress?: string
  location?: { latitude?: number; longitude?: number }
  types?: string[]
  primaryType?: string
  nationalPhoneNumber?: string
  internationalPhoneNumber?: string
  websiteUri?: string
  regularOpeningHours?: { weekdayDescriptions?: string[] }
  businessStatus?: string
  googleMapsUri?: string
  editorialSummary?: { text?: string }
}

const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.shortFormattedAddress',
  'places.location',
  'places.types',
  'places.primaryType',
  'places.nationalPhoneNumber',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.regularOpeningHours.weekdayDescriptions',
  'places.businessStatus',
  'places.googleMapsUri',
  'places.editorialSummary',
].join(',')

// Types that can plausibly operate tennis courts. Used to rank results.
const RELEVANT_TYPES = new Set([
  'sports_club', 'sports_complex', 'sports_activity_location', 'athletic_field', 'park',
  'community_center', 'fitness_center', 'gym', 'golf_course', 'school', 'primary_school',
  'secondary_school', 'university', 'hotel', 'resort_hotel', 'apartment_complex',
  'apartment_building', 'condominium_complex', 'housing_complex', 'country_club',
  'swimming_pool', 'recreation_center', 'stadium',
])

const IRRELEVANT_TYPES = new Set([
  'restaurant', 'cafe', 'store', 'bar', 'grocery_store', 'gas_station', 'bank', 'pharmacy',
  'hair_salon', 'dentist', 'doctor', 'real_estate_agency', 'car_repair', 'parking',
])

export function hasGooglePlacesKey(): boolean {
  return Boolean(process.env['GOOGLE_PLACES_API_KEY'])
}

async function placesRequest(path: 'places:searchText' | 'places:searchNearby', body: unknown): Promise<RawPlace[]> {
  const key = process.env['GOOGLE_PLACES_API_KEY']
  if (!key) return []
  const res = await fetch(`https://places.googleapis.com/v1/${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': key,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(20_000),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`Google Places ${path} → HTTP ${res.status}: ${text.slice(0, 300)}`)
  }
  const json = (await res.json()) as { places?: RawPlace[] }
  return json.places ?? []
}

function toPlace(raw: RawPlace, lat: number, lng: number): GooglePlace | null {
  const name = raw.displayName?.text
  const plat = raw.location?.latitude
  const plng = raw.location?.longitude
  if (!raw.id || !name || plat == null || plng == null) return null
  const types = raw.types ?? []
  const hours = raw.regularOpeningHours?.weekdayDescriptions
  return {
    placeId: raw.id,
    name,
    kind: kindFromGoogleTypes(types, name),
    types,
    address: raw.formattedAddress ?? raw.shortFormattedAddress ?? null,
    lat: plat,
    lng: plng,
    distanceM: haversineM(lat, lng, plat, plng),
    phone: raw.nationalPhoneNumber ?? raw.internationalPhoneNumber ?? null,
    website: raw.websiteUri ?? null,
    openingHours: hours && hours.length > 0 ? hours.join('; ') : null,
    description: raw.editorialSummary?.text ?? null,
    googleMapsUri: raw.googleMapsUri ?? null,
    businessStatus: raw.businessStatus ?? null,
  }
}

function score(p: GooglePlace, hintName: string | null): number {
  let s = 0
  if (p.types.some((t) => RELEVANT_TYPES.has(t))) s += 30
  if (p.types.some((t) => IRRELEVANT_TYPES.has(t))) s -= 60
  if (/tennis/i.test(p.name)) s += 25
  if (hintName && similar(hintName, p.name)) s += 40
  if (p.phone) s += 8
  if (p.website) s += 8
  if (p.businessStatus === 'CLOSED_PERMANENTLY') s -= 100
  // Distance penalty: 0 at 0 m, -30 at 300 m
  s -= Math.min(30, p.distanceM / 10)
  return s
}

function similar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, '').replace(/\b(the|park|tennis|courts?|center|centre|club)\b/g, '').trim()
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return false
  return na.includes(nb) || nb.includes(na)
}

/**
 * Find the organization at this point. Strategy:
 *   1. Text Search "tennis courts" biased to the point (finds tennis centers, clubs, parks)
 *   2. Nearby Search by facility types, ranked by distance (finds parks / schools / HOAs
 *      that don't mention tennis in their Google listing)
 * Returns the best candidate within `maxDistanceM`, or null.
 */
export async function googleOrganizationAt(
  lat: number,
  lng: number,
  opts: { hintName?: string | null; maxDistanceM?: number; cityLabel?: string } = {},
): Promise<{ place: GooglePlace | null; requests: number }> {
  const maxD = opts.maxDistanceM ?? 320
  let requests = 0
  const candidates: GooglePlace[] = []

  const textQuery = opts.hintName
    ? `${opts.hintName} tennis courts`
    : `tennis courts${opts.cityLabel ? ` ${opts.cityLabel}` : ''}`

  requests++
  const text = await placesRequest('places:searchText', {
    textQuery,
    maxResultCount: 6,
    locationBias: { circle: { center: { latitude: lat, longitude: lng }, radius: maxD } },
  })
  for (const raw of text) {
    const p = toPlace(raw, lat, lng)
    if (p && p.distanceM <= maxD) candidates.push(p)
  }

  if (candidates.length === 0 || !candidates.some((c) => score(c, opts.hintName ?? null) > 20)) {
    requests++
    const nearby = await placesRequest('places:searchNearby', {
      includedTypes: [
        'park', 'sports_complex', 'sports_club', 'sports_activity_location', 'athletic_field',
        'community_center', 'fitness_center', 'golf_course', 'school', 'university',
        'hotel', 'apartment_complex',
      ],
      maxResultCount: 8,
      rankPreference: 'DISTANCE',
      locationRestriction: { circle: { center: { latitude: lat, longitude: lng }, radius: Math.min(maxD, 250) } },
    })
    for (const raw of nearby) {
      const p = toPlace(raw, lat, lng)
      if (p && !candidates.some((c) => c.placeId === p.placeId)) candidates.push(p)
    }
  }

  if (candidates.length === 0) return { place: null, requests }
  candidates.sort((a, b) => score(b, opts.hintName ?? null) - score(a, opts.hintName ?? null))
  const best = candidates[0]!
  return { place: score(best, opts.hintName ?? null) > 0 ? best : null, requests }
}

// ─── Nominatim reverse (address only) ─────────────────────────────────────────

let lastNominatimAt = 0

export async function reverseAddress(lat: number, lng: number): Promise<string | null> {
  // Nominatim usage policy: max 1 request / second
  const wait = 1_100 - (Date.now() - lastNominatimAt)
  if (wait > 0) await sleep(wait)
  lastNominatimAt = Date.now()

  try {
    const url = `https://nominatim.openstreetmap.org/reverse?lat=${lat}&lon=${lng}&format=json&zoom=18&addressdetails=1`
    const res = await fetch(url, {
      headers: { 'User-Agent': 'TennisApp/1.0 (catalog-builder; contact@tennisapp.com)' },
      signal: AbortSignal.timeout(10_000),
    })
    if (!res.ok) return null
    const json = (await res.json()) as {
      address?: Record<string, string>
    }
    const a = json.address ?? {}
    const street = a['house_number'] && a['road'] ? `${a['house_number']} ${a['road']}` : a['road']
    const city = a['city'] ?? a['town'] ?? a['village'] ?? a['municipality']
    const parts = [street, city, a['state'] ? `${stateAbbrev(a['state'])}${a['postcode'] ? ` ${a['postcode']}` : ''}` : a['postcode']].filter(Boolean)
    return parts.length ? parts.join(', ') : null
  } catch {
    return null
  }
}

const US_STATES: Record<string, string> = { Texas: 'TX' }
function stateAbbrev(state: string): string {
  return US_STATES[state] ?? state
}
