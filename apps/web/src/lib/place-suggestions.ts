import { haversineKm } from './travel'

/**
 * City autocomplete rows from Nominatim.
 *
 * The same name exists in many regions (Austin, Springfield, Paris). Each row
 * keeps the short name and a context line that says which one it is. Nearby
 * hits that are the same place on the map (a city relation plus its duplicate
 * node) collapse into one row.
 */

export interface NominatimAddress {
  country?: string
  country_code?: string
  state?: string
  state_district?: string
  region?: string
  county?: string
  city?: string
  town?: string
  village?: string
  municipality?: string
  hamlet?: string
  suburb?: string
  neighbourhood?: string
}

export interface NominatimPlace {
  place_id: number
  name: string
  display_name: string
  lat: string
  lon: string
  boundingbox?: [string, string, string, string]
  class?: string
  type?: string
  addresstype?: string
  importance?: number
  address?: NominatimAddress
}

export interface PlaceSuggestion {
  place: NominatimPlace
  title: string
  subtitle: string
}

const PLACE_CLASSES = new Set(['place', 'boundary', 'landuse'])

/** A neighbourhood or suburb needs its parent city; a city does not. */
const SUBCITY = new Set([
  'suburb',
  'neighbourhood',
  'neighborhood',
  'quarter',
  'city_district',
  'borough',
  'hamlet',
  'allotments',
  'locality',
])

/** Duplicate OSM objects for one city sit on top of each other. Distinct towns do not. */
const SAME_PLACE_KM = 40

function norm(value: string | undefined): string {
  return (value ?? '').trim().toLowerCase().replace(/^city of\s+/, '').replace(/\s+/g, ' ')
}

function coordsOf(place: NominatimPlace): { lat: number; lng: number } | null {
  const lat = Number(place.lat)
  const lng = Number(place.lon)
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null
  return { lat, lng }
}

function samePlace(a: NominatimPlace, b: NominatimPlace): boolean {
  const name = norm(a.name)
  if (!name || name !== norm(b.name)) return false
  const countryA = (a.address?.country_code ?? norm(a.address?.country)).toLowerCase()
  const countryB = (b.address?.country_code ?? norm(b.address?.country)).toLowerCase()
  if (countryA && countryB && countryA !== countryB) return false
  const stateA = norm(a.address?.state || a.address?.state_district || a.address?.region)
  const stateB = norm(b.address?.state || b.address?.state_district || b.address?.region)
  if (stateA && stateB && stateA !== stateB) return false
  if (a.display_name && a.display_name === b.display_name) return true
  const left = coordsOf(a)
  const right = coordsOf(b)
  if (!left || !right) return false
  return haversineKm(left.lat, left.lng, right.lat, right.lng) <= SAME_PLACE_KM
}

function dedupePlaces(places: NominatimPlace[]): NominatimPlace[] {
  const kept: NominatimPlace[] = []
  for (const place of places) {
    if (kept.some((other) => samePlace(place, other))) continue
    kept.push(place)
  }
  return kept
}

function filterPlaces(results: NominatimPlace[]): NominatimPlace[] {
  const places = results.filter((place) => place.class != null && PLACE_CLASSES.has(place.class))
  return places.length > 0 ? places : results
}

function useful(part: string | undefined, name: string): part is string {
  if (!part?.trim()) return false
  const value = norm(part)
  if (!value || value === name) return false
  if (value.replace(/\s+county$/, '') === name) return false
  return true
}

function uniqueParts(parts: Array<string | undefined>, name: string): string[] {
  const seen = new Set<string>()
  const out: string[] = []
  for (const part of parts) {
    if (!useful(part, name)) continue
    const key = norm(part)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(part.trim())
  }
  return out
}

function shortParts(place: NominatimPlace): string[] {
  const address = place.address ?? {}
  const name = norm(place.name)
  const kind = place.addresstype || place.type || ''
  const parent = SUBCITY.has(kind)
    ? [address.city, address.town, address.village, address.municipality].find((part) => useful(part, name))
    : undefined
  const state = address.state || address.state_district || address.region
  const region = useful(state, name) ? state : useful(address.county, name) ? address.county : undefined
  return uniqueParts([parent, region, address.country], name)
}

function extraParts(place: NominatimPlace): string[] {
  const address = place.address ?? {}
  const name = norm(place.name)
  return uniqueParts(
    [address.county, address.state_district, address.region, address.municipality, address.city, address.town, address.village],
    name,
  )
}

function fallbackSubtitle(place: NominatimPlace, title: string): string {
  const display = place.display_name?.trim()
  if (!display) return ''
  const tail = display.toLowerCase().startsWith(title.trim().toLowerCase())
    ? display.slice(title.trim().length).replace(/^[\s,]+/, '')
    : display
  return tail
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0 && !/\d/.test(part))
    .join(', ')
}

function subtitleHas(subtitle: string, part: string): boolean {
  const key = norm(part)
  return subtitle.split(',').some((piece) => norm(piece) === key)
}

/**
 * Turn a Nominatim payload into at most `limit` rows whose labels differ.
 * Results stay in the order Nominatim ranked them.
 */
export function toPlaceSuggestions(results: NominatimPlace[], limit = 5): PlaceSuggestion[] {
  if (!Array.isArray(results)) return []
  const picked = dedupePlaces(filterPlaces(results)).slice(0, limit)
  const rows: PlaceSuggestion[] = picked.map((place) => {
    const title = place.name?.trim() || place.display_name
    const subtitle = shortParts(place).join(', ') || fallbackSubtitle(place, title)
    return { place, title, subtitle }
  })

  for (let pass = 0; pass < 4; pass++) {
    const groups = new Map<string, number[]>()
    rows.forEach((row, index) => {
      const key = `${norm(row.title)}|${norm(row.subtitle)}`
      const list = groups.get(key) ?? []
      list.push(index)
      groups.set(key, list)
    })
    let changed = false
    for (const indexes of groups.values()) {
      if (indexes.length < 2) continue
      for (const index of indexes) {
        const row = rows[index]
        if (!row) continue
        const extra = extraParts(row.place).find((part) => !subtitleHas(row.subtitle, part))
        if (!extra) continue
        row.subtitle = row.subtitle ? `${extra}, ${row.subtitle}` : extra
        changed = true
      }
    }
    if (!changed) break
  }

  return rows
}

/** Label stored after a pick, e.g. "Austin, Texas, United States". */
export function placeSuggestionLabel(row: PlaceSuggestion): string {
  return row.subtitle ? `${row.title}, ${row.subtitle}` : row.title
}
