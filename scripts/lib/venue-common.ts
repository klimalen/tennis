/**
 * Shared helpers for the venue catalog pipeline (scripts/venue-pipeline.ts).
 */

import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'
import { fileURLToPath } from 'url'

// ─── Env ──────────────────────────────────────────────────────────────────────

const __dirname = path.dirname(fileURLToPath(import.meta.url))
export const SCRIPTS_DIR = path.join(__dirname, '..')
export const CACHE_DIR = path.join(SCRIPTS_DIR, '.cache')

export function loadEnvLocal() {
  const envPath = path.join(SCRIPTS_DIR, '..', 'apps', 'web', '.env.local')
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

export function requireEnv(key: string): string {
  const v = process.env[key]
  if (!v) throw new Error(`Missing env var: ${key}`)
  return v
}

export function supabaseAdmin(): SupabaseClient {
  return createClient(requireEnv('NEXT_PUBLIC_SUPABASE_URL'), requireEnv('SUPABASE_SERVICE_ROLE_KEY'), {
    auth: { persistSession: false },
  })
}

// ─── CLI args ─────────────────────────────────────────────────────────────────

export interface CliArgs {
  command: string
  positional: string[]
  flags: Record<string, string | boolean>
}

export function parseArgs(argv: string[]): CliArgs {
  const [command = 'help', ...rest] = argv
  const positional: string[] = []
  const flags: Record<string, string | boolean> = {}
  for (let i = 0; i < rest.length; i++) {
    const a = rest[i]!
    if (a.startsWith('--')) {
      const eq = a.indexOf('=')
      if (eq > 0) {
        flags[a.slice(2, eq)] = a.slice(eq + 1)
      } else {
        const next = rest[i + 1]
        if (next !== undefined && !next.startsWith('--')) {
          flags[a.slice(2)] = next
          i++
        } else {
          flags[a.slice(2)] = true
        }
      }
    } else {
      positional.push(a)
    }
  }
  return { command, positional, flags }
}

export function flagNumber(flags: CliArgs['flags'], key: string, fallback: number): number {
  const v = flags[key]
  if (v === undefined || v === true) return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// ─── City config ──────────────────────────────────────────────────────────────

export interface BBox {
  south: number
  west: number
  north: number
  east: number
}

export interface CityConfig {
  slug: string
  label: string
  region: string
  country: string
  timezone: string
  bbox: BBox
}

export const CITIES: Record<string, CityConfig> = {
  austin: {
    slug: 'austin',
    label: 'Austin',
    region: 'Texas',
    country: 'US',
    timezone: 'America/Chicago',
    bbox: { south: 30.05, west: -98.05, north: 30.6, east: -97.35 },
  },
}

export function cityFromFlags(flags: CliArgs['flags']): CityConfig {
  const slug = typeof flags['city'] === 'string' ? flags['city'] : 'austin'
  const city = CITIES[slug]
  if (!city) throw new Error(`Unknown city "${slug}". Known: ${Object.keys(CITIES).join(', ')}`)
  return city
}

// ─── Geo ──────────────────────────────────────────────────────────────────────

export function haversineM(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(lat2 - lat1)
  const dLng = toRad(lng2 - lng1)
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))
}

export interface LatLng {
  lat: number
  lng: number
}

export function centroid(points: LatLng[]): LatLng {
  if (points.length === 0) throw new Error('centroid of empty set')
  let lat = 0
  let lng = 0
  for (const p of points) {
    lat += p.lat
    lng += p.lng
  }
  return { lat: lat / points.length, lng: lng / points.length }
}

/** Ray-casting point-in-polygon. `ring` is [lat, lng][] (closed or open). */
export function pointInRing(lat: number, lng: number, ring: [number, number][]): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [yi, xi] = ring[i]!
    const [yj, xj] = ring[j]!
    const intersects = yi > lat !== yj > lat && lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi
    if (intersects) inside = !inside
  }
  return inside
}

/** Approximate area of a lat/lng bounding box in m² */
export function bboxAreaM2(b: { minlat: number; minlon: number; maxlat: number; maxlon: number }): number {
  const lat = (b.maxlat + b.minlat) / 2
  const dlat = (b.maxlat - b.minlat) * 111_320
  const dlng = (b.maxlon - b.minlon) * 111_320 * Math.cos((lat * Math.PI) / 180)
  return Math.abs(dlat * dlng)
}

// ─── Union-find (single-linkage clustering) ───────────────────────────────────

export class UnionFind {
  private parent: number[]
  constructor(n: number) {
    this.parent = Array.from({ length: n }, (_, i) => i)
  }
  find(i: number): number {
    while (this.parent[i] !== i) {
      this.parent[i] = this.parent[this.parent[i]!]!
      i = this.parent[i]!
    }
    return i
  }
  union(a: number, b: number) {
    const ra = this.find(a)
    const rb = this.find(b)
    if (ra !== rb) this.parent[ra] = rb
  }
}

// ─── Normalization ────────────────────────────────────────────────────────────

export type Surface = 'hard' | 'clay' | 'grass' | 'carpet' | 'synthetic'

const SURFACE_MAP: Record<string, Surface> = {
  hard: 'hard',
  hardcourt: 'hard',
  'hard court': 'hard',
  concrete: 'hard',
  asphalt: 'hard',
  acrylic: 'hard',
  paved: 'hard',
  tarmac: 'hard',
  cushioned: 'hard',
  'laykold': 'hard',
  'plexicushion': 'hard',
  'deco turf': 'hard',
  decoturf: 'hard',
  clay: 'clay',
  'har-tru': 'clay',
  hartru: 'clay',
  'green clay': 'clay',
  'red clay': 'clay',
  grass: 'grass',
  lawn: 'grass',
  carpet: 'carpet',
  tartan: 'carpet',
  synthetic: 'synthetic',
  artificial_turf: 'synthetic',
  'artificial turf': 'synthetic',
  'artificial grass': 'synthetic',
  astroturf: 'synthetic',
}

export function normalizeSurface(raw: string | null | undefined): Surface | null {
  if (!raw) return null
  const key = raw.trim().toLowerCase()
  if (SURFACE_MAP[key]) return SURFACE_MAP[key]
  // Try to find a known token inside a longer phrase ("8 hard courts, 2 clay")
  for (const [token, value] of Object.entries(SURFACE_MAP)) {
    if (key.includes(token)) return value
  }
  return null
}

export type Access = 'public' | 'private' | 'members' | 'customers'

export function normalizeAccess(raw: string | null | undefined): Access | null {
  if (!raw) return null
  const k = raw.trim().toLowerCase()
  if (k === 'yes' || k === 'public' || k === 'permissive') return 'public'
  if (k === 'private' || k === 'no') return 'private'
  if (k === 'members' || k === 'members only' || k === 'membership') return 'members'
  if (k === 'customers' || k === 'guests' || k === 'residents') return 'customers'
  return null
}

export type VenueKind =
  | 'public_park'
  | 'tennis_center'
  | 'club'
  | 'school'
  | 'residential'
  | 'hotel'
  | 'commercial'
  | 'other'
  | 'unknown'

export const KIND_LABEL: Record<VenueKind, string> = {
  public_park: 'Public park',
  tennis_center: 'Tennis center',
  club: 'Club',
  school: 'School',
  residential: 'Residential (private)',
  hotel: 'Hotel / resort',
  commercial: 'Commercial',
  other: 'Facility',
  unknown: 'Tennis courts',
}

/** Map OSM tags of an enclosing feature to a venue kind. */
export function kindFromOsmTags(tags: Record<string, string>): VenueKind {
  const leisure = tags['leisure']
  const amenity = tags['amenity']
  const landuse = tags['landuse']
  const name = (tags['name'] ?? '').toLowerCase()

  if (/tennis (center|centre)/.test(name)) return 'tennis_center'
  if (tags['club'] || amenity === 'club' || /country club|racquet club|tennis club|athletic club|swim (and|&) tennis/.test(name)) return 'club'
  if (leisure === 'sports_centre' && tags['sport'] === 'tennis') return 'tennis_center'
  if (leisure === 'park' || leisure === 'recreation_ground' || leisure === 'nature_reserve' || landuse === 'recreation_ground') return 'public_park'
  if (amenity === 'school' || amenity === 'college' || amenity === 'university' || /\b(school|academy|university|college|isd)\b/.test(name)) return 'school'
  if (landuse === 'residential' || tags['building'] === 'apartments' || tags['tourism'] === 'apartment' || /\b(hoa|apartments?|condos?|villas?|residences?|neighborhood|subdivision)\b/.test(name)) return 'residential'
  if (tags['tourism'] === 'hotel' || tags['tourism'] === 'resort' || leisure === 'resort' || tags['building'] === 'hotel') return 'hotel'
  if (leisure === 'sports_centre' || leisure === 'fitness_centre' || leisure === 'stadium' || leisure === 'golf_course') return 'club'
  if (landuse === 'retail' || landuse === 'commercial') return 'commercial'
  if (amenity === 'community_centre' || amenity === 'social_facility' || amenity === 'place_of_worship') return 'other'
  return 'other'
}

/** Map Google Places types to a venue kind. */
export function kindFromGoogleTypes(types: string[], displayName: string): VenueKind {
  const set = new Set(types)
  const name = displayName.toLowerCase()
  if (/tennis (center|centre)/.test(name)) return 'tennis_center'
  if (/country club|racquet club|tennis club|athletic club|swim (and|&) tennis/.test(name)) return 'club'
  if (set.has('park') || set.has('national_park') || set.has('state_park')) return 'public_park'
  if (set.has('school') || set.has('primary_school') || set.has('secondary_school') || set.has('university')) return 'school'
  if (set.has('apartment_complex') || set.has('apartment_building') || set.has('housing_complex') || set.has('condominium_complex') || /\b(hoa|apartments?|condos?)\b/.test(name)) return 'residential'
  if (set.has('hotel') || set.has('resort_hotel') || set.has('lodging')) return 'hotel'
  if (set.has('sports_club') || set.has('sports_complex') || set.has('fitness_center') || set.has('gym') || set.has('golf_course') || set.has('sports_activity_location') || set.has('athletic_field')) return 'club'
  if (set.has('community_center')) return 'other'
  return 'other'
}

export const PRIVATE_KINDS: ReadonlySet<VenueKind> = new Set<VenueKind>(['residential', 'hotel'])

/** Names that mark a court as clearly not a public organization. */
export const PRIVATE_NAME_RE = /\b(hoa|homeowners|residence|residents only|not for public|private|apartments?|condos?|townhomes?)\b/i

export function normalizePhone(raw: string | null | undefined): string | null {
  if (!raw) return null
  const digits = raw.replace(/[^\d+]/g, '')
  const m = digits.match(/^\+?1?(\d{3})(\d{3})(\d{4})$/)
  if (m) return `(${m[1]}) ${m[2]}-${m[3]}`
  return raw.trim().slice(0, 40) || null
}

export function normalizeWebsite(raw: string | null | undefined): string | null {
  if (!raw) return null
  let url = raw.trim()
  if (!url) return null
  if (!/^https?:\/\//i.test(url)) url = `https://${url}`
  try {
    const u = new URL(url)
    if (!u.hostname.includes('.')) return null
    // Strip tracking noise
    u.hash = ''
    return u.toString().replace(/\/$/, '')
  } catch {
    return null
  }
}

export function clampText(raw: string | null | undefined, max: number): string | null {
  if (!raw) return null
  const t = raw.replace(/\s+/g, ' ').trim()
  if (!t) return null
  return t.length > max ? `${t.slice(0, max - 1).trimEnd()}…` : t
}

// ─── Misc ─────────────────────────────────────────────────────────────────────

export function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms))
}

export function readJsonCache<T>(file: string, maxAgeMs: number): T | null {
  try {
    const p = path.join(CACHE_DIR, file)
    if (!fs.existsSync(p)) return null
    if (Date.now() - fs.statSync(p).mtimeMs > maxAgeMs) return null
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T
  } catch {
    return null
  }
}

export function writeJsonCache(file: string, data: unknown) {
  fs.mkdirSync(CACHE_DIR, { recursive: true })
  fs.writeFileSync(path.join(CACHE_DIR, file), JSON.stringify(data))
}

export interface SourceRef {
  type: 'osm' | 'osm_parent' | 'austin_open_data' | 'geoapify' | 'google_places' | 'nominatim' | 'browser_agent' | 'manual'
  url?: string | undefined
  fetched_at: string
  fields?: string[] | undefined
}
