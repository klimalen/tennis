/**
 * Venue catalog pipeline: turn raw OSM court polygons into organizations
 * ("who runs these courts, how do I contact them, what do they have").
 *
 *   pnpm venues cluster   [--city austin] [--dry-run] [--no-cache]
 *       Group raw `venues` rows into `venue_groups` (same OSM parent polygon, or
 *       courts within LINK_M of each other). Idempotent: re-running keeps groups
 *       and their enrichment, only membership / centroids are refreshed.
 *
 *   pnpm venues identify  [--city austin] [--limit N] [--force] [--dry-run]
 *       For groups without a name (or all with --force): find the organization by
 *       geography — enclosing OSM feature → Google Places (if GOOGLE_PLACES_API_KEY)
 *       → Nominatim for the postal address.
 *
 *   pnpm venues queue     [--city austin] [--out file] [--include-private]
 *       Export groups that still miss data to a JSON work-queue. Anyone can fill
 *       `items[].result` (Claude agent, a Cursor agent with a browser, a human).
 *
 *   pnpm venues apply <file> [--overwrite] [--dry-run]
 *       Validate + write results from a filled queue file back to `venue_groups`.
 *
 *   pnpm venues agent     [--city austin] [--limit N] [--dry-run] [--out file]
 *       Fill the queue with Claude (Anthropic web_search + page fetch), then apply.
 *       Needs ANTHROPIC_API_KEY. --dry-run writes the filled queue without applying.
 *
 *   pnpm venues stats     [--city austin]
 *   pnpm venues all       [--city austin]      = cluster + identify + queue
 *
 * Env (auto-loaded from apps/web/.env.local): NEXT_PUBLIC_SUPABASE_URL,
 * SUPABASE_SERVICE_ROLE_KEY. Optional: GOOGLE_PLACES_API_KEY, ANTHROPIC_API_KEY.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SupabaseClient } from '@supabase/supabase-js'
import * as fs from 'fs'
import * as path from 'path'

import { buildClusters, deriveGroupFields, isGenericName, mostCommon, STREET_ADDRESS_RE, type VenueRow } from './lib/clustering'
import { fetchPage } from './lib/fetch-page'
import { contactsFromTags, findParent, loadParentIndex } from './lib/osm-parents'
import { googleOrganizationAt, hasGooglePlacesKey, reverseAddress } from './lib/places'
import {
  type Access,
  CACHE_DIR,
  type CityConfig,
  cityFromFlags,
  clampText,
  flagNumber,
  KIND_LABEL,
  loadEnvLocal,
  normalizeAccess,
  normalizePhone,
  normalizeSurface,
  normalizeWebsite,
  parseArgs,
  PRIVATE_KINDS,
  PRIVATE_NAME_RE,
  requireEnv,
  sleep,
  type SourceRef,
  supabaseAdmin,
  type VenueKind,
} from './lib/venue-common'

loadEnvLocal()

// ─── Config ───────────────────────────────────────────────────────────────────

/** Fields the app wants on a card; a group is "complete" when it has them all. */
const WANTED_FIELDS = ['phone', 'website', 'opening_hours', 'court_count', 'surface', 'description'] as const
type WantedField = (typeof WANTED_FIELDS)[number]

// ─── DB row types ─────────────────────────────────────────────────────────────

interface GroupRow {
  id: string
  name: string | null
  kind: VenueKind
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
  access: Access | null
  fee: boolean | null
  osm_parent_id: string | null
  google_place_id: string | null
  google_maps_uri: string | null
  sources: SourceRef[]
  confidence: 'low' | 'medium' | 'high'
  needs_enrichment: boolean
  enriched_at: string | null
  enrichment_attempts: number
}

const GROUP_COLUMNS =
  'id, name, kind, lat, lng, address, phone, website, opening_hours, description, court_count, court_count_osm, member_count, surface, lit, has_indoor, has_outdoor, access, fee, osm_parent_id, google_place_id, google_maps_uri, sources, confidence, needs_enrichment, enriched_at, enrichment_attempts'

// ─── DB helpers ───────────────────────────────────────────────────────────────

async function fetchAll<T>(build: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: { message: string } | null }>): Promise<T[]> {
  const PAGE = 1000
  const out: T[] = []
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await build(from, from + PAGE - 1)
    if (error) throw new Error(error.message)
    if (!data || data.length === 0) break
    out.push(...data)
    if (data.length < PAGE) break
  }
  return out
}

function inBbox<T extends { gte: (c: string, v: number) => T; lte: (c: string, v: number) => T }>(q: T, city: CityConfig): T {
  return q.gte('lat', city.bbox.south).lte('lat', city.bbox.north).gte('lng', city.bbox.west).lte('lng', city.bbox.east)
}

async function loadVenues(sb: SupabaseClient, city: CityConfig): Promise<VenueRow[]> {
  return fetchAll<VenueRow>((from, to) =>
    inBbox(
      sb.from('venues').select('id, osm_id, name, lat, lng, address, surface, court_count, lit, access, fee, website, phone, operator, opening_hours, description, has_indoor, has_outdoor, sources, group_id'),
      city,
    ).order('id').range(from, to),
  )
}

async function loadGroups(sb: SupabaseClient, city: CityConfig): Promise<GroupRow[]> {
  return fetchAll<GroupRow>((from, to) => inBbox(sb.from('venue_groups').select(GROUP_COLUMNS), city).order('id').range(from, to))
}

function missingFields(g: Pick<GroupRow, WantedField>): WantedField[] {
  return WANTED_FIELDS.filter((f) => g[f] == null || g[f] === '')
}

// ═══════════════════════════════════════════════════════════════════════════════
// cluster
// ═══════════════════════════════════════════════════════════════════════════════

async function cmdCluster(sb: SupabaseClient, city: CityConfig, flags: Record<string, string | boolean>) {
  const dryRun = flags['dry-run'] === true
  console.log(`\n🧩 Clustering courts → organizations for ${city.label}${dryRun ? ' [DRY RUN]' : ''}\n`)

  console.log('→ Loading OSM parent features (parks, clubs, schools, HOAs)…')
  const parents = await loadParentIndex(city, { noCache: flags['no-cache'] === true })
  console.log(`   ${parents.features.length} named candidate polygons`)

  console.log('→ Loading raw venues…')
  const venues = await loadVenues(sb, city)
  console.log(`   ${venues.length} court records`)

  const clusters = buildClusters(venues, parents)
  const withParent = clusters.filter((c) => c.parent).length
  const multi = clusters.filter((c) => c.members.length > 1).length
  console.log(`\n→ ${clusters.length} groups (${multi} with 2+ courts, ${withParent} inside a named OSM feature)`)

  const existing = await loadGroups(sb, city)
  const existingById = new Map(existing.map((g) => [g.id, g]))

  let created = 0
  let updated = 0
  const touchedGroupIds = new Set<string>()
  const now = new Date().toISOString()

  for (const c of clusters) {
    const d = deriveGroupFields(c)
    const prevId = mostCommon(c.members.map((v) => v.group_id))
    const prev = prevId ? existingById.get(prevId) : undefined

    // Never clobber identified / enriched data — only fill gaps and refresh derived facts.
    const sources: SourceRef[] = prev?.sources ? [...prev.sources] : []
    if (d.osm_parent_id && !sources.some((s) => s.type === 'osm_parent' && s.url?.endsWith(d.osm_parent_id!))) {
      sources.push({ type: 'osm_parent', url: `https://www.openstreetmap.org/${d.osm_parent_id}`, fetched_at: parents.fetchedAt, fields: ['name', 'kind'] })
    }

    const row: Record<string, unknown> = {
      lat: d.lat,
      lng: d.lng,
      court_count_osm: d.court_count_osm,
      member_count: d.member_count,
      lit: prev?.lit ?? d.lit,
      has_indoor: prev?.has_indoor ?? d.has_indoor,
      has_outdoor: prev?.has_outdoor ?? d.has_outdoor,
      name: prev?.name ?? d.name,
      kind: prev && prev.kind !== 'unknown' ? prev.kind : d.kind,
      address: prev?.address ?? d.address,
      phone: prev?.phone ?? d.phone,
      website: prev?.website ?? d.website,
      opening_hours: prev?.opening_hours ?? d.opening_hours,
      description: prev?.description ?? d.description,
      surface: prev?.surface ?? d.surface,
      access: prev?.access ?? d.access,
      fee: prev?.fee ?? d.fee,
      osm_parent_id: prev?.osm_parent_id ?? d.osm_parent_id,
      confidence: prev && prev.confidence !== 'low' ? prev.confidence : d.parent_confidence,
      sources,
    }
    const merged = { ...(prev ?? {}), ...row } as GroupRow
    row['needs_enrichment'] = computeNeedsEnrichment(merged)

    if (dryRun) {
      if (prev) updated++
      else created++
      continue
    }

    let groupId: string
    if (prev) {
      const { error } = await sb.from('venue_groups').update(row).eq('id', prev.id)
      if (error) throw new Error(`update group ${prev.id}: ${error.message}`)
      groupId = prev.id
      updated++
    } else {
      const { data, error } = await sb.from('venue_groups').insert({ ...row, created_at: now }).select('id').single()
      if (error || !data) throw new Error(`insert group: ${error?.message}`)
      groupId = data.id as string
      created++
    }
    touchedGroupIds.add(groupId)

    const toAttach = c.members.filter((v) => v.group_id !== groupId).map((v) => v.id)
    if (toAttach.length > 0) {
      const { error } = await sb.from('venues').update({ group_id: groupId }).in('id', toAttach)
      if (error) throw new Error(`attach venues: ${error.message}`)
    }
  }

  // Groups that lost all members
  let removed = 0
  if (!dryRun) {
    const orphans = existing.filter((g) => !touchedGroupIds.has(g.id))
    for (const g of orphans) {
      const { count } = await sb.from('venues').select('id', { count: 'exact', head: true }).eq('group_id', g.id)
      if ((count ?? 0) === 0) {
        await sb.from('venue_groups').delete().eq('id', g.id)
        removed++
      }
    }
  }

  console.log(`\n📊 Groups: ${created} created, ${updated} updated, ${removed} removed`)
  if (dryRun) {
    console.log('\n[DRY RUN] Sample groups:')
    for (const c of clusters.filter((x) => x.members.length >= 2).slice(0, 12)) {
      const d = deriveGroupFields(c)
      console.log(`   • ${d.name ?? '(unnamed)'} [${KIND_LABEL[d.kind]}] — ${d.member_count} courts @ ${d.lat.toFixed(5)}, ${d.lng.toFixed(5)}${d.phone ? ' ☎' : ''}${d.website ? ' 🌐' : ''}`)
    }
  }
}

function computeNeedsEnrichment(g: GroupRow): boolean {
  if (PRIVATE_KINDS.has(g.kind)) return false
  if (!g.name || isGenericName(g.name)) return true // needs identification first
  return missingFields(g).length > 0
}

// ═══════════════════════════════════════════════════════════════════════════════
// identify
// ═══════════════════════════════════════════════════════════════════════════════

async function cmdIdentify(sb: SupabaseClient, city: CityConfig, flags: Record<string, string | boolean>) {
  const dryRun = flags['dry-run'] === true
  const force = flags['force'] === true
  const limit = flagNumber(flags, 'limit', Infinity)
  const useGoogle = hasGooglePlacesKey() && flags['no-google'] !== true

  console.log(`\n🔎 Identifying organizations for ${city.label}${dryRun ? ' [DRY RUN]' : ''}`)
  console.log(`   Google Places: ${useGoogle ? 'enabled' : 'disabled (no GOOGLE_PLACES_API_KEY)'}\n`)

  const parents = await loadParentIndex(city, { noCache: flags['no-cache'] === true })
  const groups = await loadGroups(sb, city)
  const targets = groups
    .filter((g) => force || !g.name || isGenericName(g.name) || g.confidence === 'low')
    .filter((g) => !PRIVATE_KINDS.has(g.kind) || force)
    .slice(0, limit)

  console.log(`→ ${targets.length} of ${groups.length} groups to identify\n`)

  let named = 0
  let googleHits = 0
  let googleRequests = 0
  const now = new Date().toISOString()

  for (const [i, g] of targets.entries()) {
    const update: Record<string, unknown> = {}
    const sources: SourceRef[] = [...(g.sources ?? [])]
    const log: string[] = []

    // 1. Enclosing OSM feature at the centroid
    const parent = findParent(parents, g.lat, g.lng)
    if (parent && (!g.name || isGenericName(g.name) || force)) {
      const contacts = contactsFromTags(parent.feature.tags)
      update['name'] = parent.feature.name
      update['kind'] = parent.feature.kind
      update['osm_parent_id'] = parent.feature.osmId
      if (!g.phone && contacts.phone) update['phone'] = normalizePhone(contacts.phone)
      if (!g.website && contacts.website) update['website'] = normalizeWebsite(contacts.website)
      if (!g.opening_hours && contacts.opening_hours) update['opening_hours'] = contacts.opening_hours
      if (!g.address && contacts.address) update['address'] = contacts.address
      update['confidence'] = parent.how === 'inside' ? 'medium' : 'low'
      if (!sources.some((s) => s.type === 'osm_parent' && s.url?.endsWith(parent.feature.osmId))) {
        sources.push({ type: 'osm_parent', url: `https://www.openstreetmap.org/${parent.feature.osmId}`, fetched_at: parents.fetchedAt, fields: ['name', 'kind'] })
      }
      log.push(`osm: ${parent.feature.name} [${parent.feature.kind}, ${parent.how}]`)
    }

    const kindNow = (update['kind'] as VenueKind | undefined) ?? g.kind
    const nameNow = (update['name'] as string | undefined) ?? g.name

    // 2. Google Places — the business listing at this point
    if (useGoogle && !PRIVATE_KINDS.has(kindNow)) {
      try {
        const { place, requests } = await googleOrganizationAt(g.lat, g.lng, { hintName: nameNow, cityLabel: `${city.label} ${city.region}` })
        googleRequests += requests
        if (place) {
          const noName = !nameNow || isGenericName(nameNow)
          const tennisSpecific = /tennis/i.test(place.name) && place.distanceM < 200
          const sameOrg = noName || tennisSpecific || namesSimilar(nameNow!, place.name)
          if (sameOrg) {
            googleHits++
            if (noName || tennisSpecific || force) update['name'] = place.name
            if (kindNow === 'unknown' || kindNow === 'other' || tennisSpecific) update['kind'] = place.kind
            if (!g.address || force) update['address'] = place.address ?? g.address
            if (!g.phone && place.phone) update['phone'] = normalizePhone(place.phone)
            if (!g.website && place.website) update['website'] = normalizeWebsite(place.website)
            if (!g.opening_hours && place.openingHours) update['opening_hours'] = place.openingHours
            if (!g.description && place.description) update['description'] = clampText(place.description, 400)
            update['google_place_id'] = place.placeId
            update['google_maps_uri'] = place.googleMapsUri
            update['confidence'] = 'high'
            sources.push({ type: 'google_places', url: place.googleMapsUri ?? undefined, fetched_at: now, fields: ['name', 'address', 'phone', 'website', 'opening_hours', 'description'].filter((f) => update[f] != null) })
            log.push(`google: ${place.name} (${Math.round(place.distanceM)} m${place.phone ? ', ☎' : ''}${place.website ? ', 🌐' : ''}${place.openingHours ? ', ⏰' : ''})`)
          } else {
            log.push(`google: "${place.name}" ≠ "${nameNow}" — ignored`)
          }
        } else {
          log.push('google: nothing relevant nearby')
        }
        await sleep(150)
      } catch (e) {
        log.push(`google error: ${e instanceof Error ? e.message : String(e)}`)
      }
    }

    // 3. Postal address (never a name)
    if (!g.address && update['address'] == null) {
      const addr = await reverseAddress(g.lat, g.lng)
      if (addr) {
        update['address'] = addr
        sources.push({ type: 'nominatim', fetched_at: now, fields: ['address'] })
        log.push(`address: ${addr}`)
      }
    }

    const finalKind = (update['kind'] as VenueKind | undefined) ?? g.kind
    const finalName = (update['name'] as string | undefined) ?? g.name
    if (finalName && PRIVATE_NAME_RE.test(finalName) && finalKind === 'unknown') update['kind'] = 'residential'
    if ((update['kind'] ?? g.kind) === 'residential' && !g.access) update['access'] = 'private'
    if ((update['kind'] ?? g.kind) === 'public_park' && !g.access) update['access'] = 'public'

    const merged = { ...g, ...update, sources } as GroupRow
    update['needs_enrichment'] = computeNeedsEnrichment(merged)
    update['sources'] = sources
    if (finalName && !isGenericName(finalName)) named++

    console.log(`[${i + 1}/${targets.length}] ${finalName ?? '(unidentified)'} — ${g.member_count} courts`)
    for (const l of log) console.log(`     ${l}`)

    if (!dryRun && Object.keys(update).length > 0) {
      const { error } = await sb.from('venue_groups').update(update).eq('id', g.id)
      if (error) console.error(`     ❌ update failed: ${error.message}`)
    }
  }

  console.log(`\n📊 Identified ${named}/${targets.length} groups; Google matches: ${googleHits} (${googleRequests} requests)`)
}

function namesSimilar(a: string, b: string): boolean {
  const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9 ]/g, ' ').replace(/\b(the|park|tennis|courts?|center|centre|club|district|neighborhood|hoa|of|at|and)\b/g, ' ').replace(/\s+/g, ' ').trim()
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return false
  if (na.includes(nb) || nb.includes(na)) return true
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  let common = 0
  for (const t of ta) if (tb.has(t) && t.length > 2) common++
  return common >= Math.min(2, Math.min(ta.size, tb.size))
}

// ═══════════════════════════════════════════════════════════════════════════════
// queue / apply
// ═══════════════════════════════════════════════════════════════════════════════

export interface EnrichmentResult {
  venue_name?: string | null
  kind?: VenueKind | null
  address?: string | null
  phone?: string | null
  website?: string | null
  opening_hours?: string | null
  court_count?: number | null
  surface?: string | null
  has_indoor?: boolean | null
  has_outdoor?: boolean | null
  lit?: boolean | null
  access?: string | null
  fee?: boolean | null
  description?: string | null
  source_urls?: string[]
  notes?: string | null
}

export interface QueueItem {
  group_id: string
  name: string | null
  kind: VenueKind
  lat: number
  lng: number
  address: string | null
  member_count: number
  court_count_osm: number
  known: Partial<Record<WantedField | 'address' | 'access' | 'has_indoor' | 'has_outdoor', unknown>>
  missing: WantedField[]
  needs_identification: boolean
  hints: {
    osm_parent_id: string | null
    osm_url: string
    google_maps_url: string
    google_maps_uri: string | null
  }
  result: EnrichmentResult | null
}

export interface QueueFile {
  version: 1
  city: string
  generated_at: string
  instructions: string
  items: QueueItem[]
}

const QUEUE_INSTRUCTIONS = `For each item fill "result" with what you can verify for THIS organization (not a neighbour):
venue_name (official name), kind (public_park|tennis_center|club|school|residential|hotel|commercial|other),
address, phone, website (official site), opening_hours (short text), court_count (total tennis courts),
surface (hard|clay|grass|carpet|synthetic), has_indoor, has_outdoor, lit, access (public|private|members|customers),
fee (true if paying is required to play), description (1–2 sentences), source_urls (where you found it).
Leave a field out (or null) if you could not verify it. Never guess.`

function buildQueue(city: CityConfig, groups: GroupRow[], includePrivate: boolean): QueueFile {
  const items: QueueItem[] = groups
    .filter((g) => (g.needs_enrichment || !g.name || isGenericName(g.name)) && (includePrivate || !PRIVATE_KINDS.has(g.kind)))
    .map((g) => ({
      group_id: g.id,
      name: g.name,
      kind: g.kind,
      lat: g.lat,
      lng: g.lng,
      address: g.address,
      member_count: g.member_count,
      court_count_osm: g.court_count_osm,
      known: Object.fromEntries(
        (['phone', 'website', 'opening_hours', 'court_count', 'surface', 'description', 'address', 'access', 'has_indoor', 'has_outdoor'] as const)
          .filter((f) => g[f] != null)
          .map((f) => [f, g[f]]),
      ),
      missing: missingFields(g),
      needs_identification: !g.name || isGenericName(g.name),
      hints: {
        osm_parent_id: g.osm_parent_id,
        osm_url: `https://www.openstreetmap.org/#map=18/${g.lat.toFixed(5)}/${g.lng.toFixed(5)}`,
        google_maps_url: `https://www.google.com/maps/search/tennis+courts/@${g.lat.toFixed(6)},${g.lng.toFixed(6)},18z`,
        google_maps_uri: g.google_maps_uri,
      },
      result: null,
    }))
    // Unidentified first (they block everything else), then biggest facilities first
    .sort((a, b) => Number(b.needs_identification) - Number(a.needs_identification) || b.court_count_osm - a.court_count_osm)

  return { version: 1, city: city.slug, generated_at: new Date().toISOString(), instructions: QUEUE_INSTRUCTIONS, items }
}

function defaultQueuePath(city: CityConfig): string {
  return path.join(CACHE_DIR, `queue-${city.slug}.json`)
}

async function cmdQueue(sb: SupabaseClient, city: CityConfig, flags: Record<string, string | boolean>) {
  const groups = await loadGroups(sb, city)
  const queue = buildQueue(city, groups, flags['include-private'] === true)
  const out = typeof flags['out'] === 'string' ? flags['out'] : defaultQueuePath(city)
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify(queue, null, 2))
  const unidentified = queue.items.filter((i) => i.needs_identification).length
  console.log(`\n📝 Queue written: ${out}`)
  console.log(`   ${queue.items.length} items (${unidentified} still unidentified, ${queue.items.length - unidentified} named but incomplete)`)
}

/** Validate + normalize a raw result (from Claude, a Cursor agent or a human). */
export function sanitizeResult(raw: EnrichmentResult): EnrichmentResult {
  const out: EnrichmentResult = {}
  const name = clampText(raw.venue_name, 120)
  if (name && !isGenericName(name) && !STREET_ADDRESS_RE.test(name)) out.venue_name = name
  const kinds: VenueKind[] = ['public_park', 'tennis_center', 'club', 'school', 'residential', 'hotel', 'commercial', 'other']
  if (raw.kind && kinds.includes(raw.kind)) out.kind = raw.kind
  const address = clampText(raw.address, 200)
  if (address) out.address = address
  const phone = normalizePhone(raw.phone)
  if (phone) out.phone = phone
  const website = normalizeWebsite(raw.website)
  if (website && !/facebook\.com|yelp\.com|google\.com|tripadvisor|nextdoor\.com/i.test(website)) out.website = website
  const hours = clampText(raw.opening_hours, 300)
  if (hours) out.opening_hours = hours
  const cc = typeof raw.court_count === 'string' ? parseInt(raw.court_count, 10) : raw.court_count
  if (typeof cc === 'number' && Number.isInteger(cc) && cc >= 1 && cc <= 200) out.court_count = cc
  const surface = normalizeSurface(raw.surface)
  if (surface) out.surface = surface
  for (const b of ['has_indoor', 'has_outdoor', 'lit', 'fee'] as const) {
    if (typeof raw[b] === 'boolean') out[b] = raw[b]
  }
  const access = normalizeAccess(raw.access)
  if (access) out.access = access
  const desc = clampText(raw.description, 400)
  if (desc) out.description = desc
  out.source_urls = (raw.source_urls ?? []).filter((u) => typeof u === 'string' && /^https?:\/\//.test(u)).slice(0, 5)
  return out
}

async function applyResults(
  sb: SupabaseClient,
  items: QueueItem[],
  opts: { overwrite: boolean; dryRun: boolean; sourceType: SourceRef['type'] },
) {
  let applied = 0
  let empty = 0
  const now = new Date().toISOString()

  for (const item of items) {
    if (!item.result) continue
    const r = sanitizeResult(item.result)

    const { data: g, error } = await sb.from('venue_groups').select(GROUP_COLUMNS).eq('id', item.group_id).single()
    if (error || !g) {
      console.log(`   ⚠ group ${item.group_id} not found`)
      continue
    }
    const group = g as GroupRow

    const update: Record<string, unknown> = {}
    const set = (field: keyof GroupRow, value: unknown) => {
      if (value == null) return
      const current = group[field]
      if (current == null || current === '' || opts.overwrite || (field === 'name' && isGenericName(current as string))) update[field] = value
    }
    set('name', r.venue_name)
    set('kind', r.kind)
    set('address', r.address)
    set('phone', r.phone)
    set('website', r.website)
    set('opening_hours', r.opening_hours)
    set('court_count', r.court_count)
    set('surface', r.surface)
    set('has_indoor', r.has_indoor)
    set('has_outdoor', r.has_outdoor)
    set('lit', r.lit)
    set('access', r.access)
    set('fee', r.fee)
    set('description', r.description)

    const fields = Object.keys(update)
    if (fields.length === 0) {
      empty++
      if (!opts.dryRun) {
        await sb.from('venue_groups').update({ enrichment_attempts: group.enrichment_attempts + 1, enriched_at: now }).eq('id', group.id)
      }
      console.log(`   – ${group.name ?? item.group_id}: nothing new`)
      continue
    }

    const sources: SourceRef[] = [...(group.sources ?? []), { type: opts.sourceType, url: r.source_urls?.[0], fetched_at: now, fields }]
    const merged = { ...group, ...update, sources } as GroupRow
    update['sources'] = sources
    update['enriched_at'] = now
    update['enrichment_attempts'] = group.enrichment_attempts + 1
    update['needs_enrichment'] = computeNeedsEnrichment(merged)
    if (merged.name && !isGenericName(merged.name) && group.confidence === 'low') update['confidence'] = 'medium'

    console.log(`   ✅ ${merged.name ?? item.group_id}: ${fields.join(', ')}`)
    if (!opts.dryRun) {
      const { error: upErr } = await sb.from('venue_groups').update(update).eq('id', group.id)
      if (upErr) console.error(`      ❌ ${upErr.message}`)
      else applied++
    } else {
      applied++
    }
  }

  console.log(`\n📊 Applied ${applied} groups, ${empty} without new data${opts.dryRun ? ' [DRY RUN — nothing written]' : ''}`)
}

async function cmdApply(sb: SupabaseClient, positional: string[], flags: Record<string, string | boolean>) {
  const file = positional[0]
  if (!file) throw new Error('Usage: pnpm venues apply <queue.json> [--overwrite] [--dry-run]')
  const queue = JSON.parse(fs.readFileSync(file, 'utf-8')) as QueueFile
  const filled = queue.items.filter((i) => i.result)
  console.log(`\n📥 Applying ${filled.length} filled items from ${file}\n`)
  await applyResults(sb, filled, { overwrite: flags['overwrite'] === true, dryRun: flags['dry-run'] === true, sourceType: 'manual' })
}

// ═══════════════════════════════════════════════════════════════════════════════
// agent (Claude + web search)
// ═══════════════════════════════════════════════════════════════════════════════

const MAX_PAGES_PER_ITEM = 5
const MAX_TURNS = 12

const fetchPageTool: Anthropic.Tool = {
  name: 'fetch_page',
  description: 'Fetch a web page and return its readable text; link targets follow their anchor text in [square brackets]. Use it to read an official website, a city parks page, or a court directory page you found via web_search.',
  input_schema: {
    type: 'object' as const,
    properties: { url: { type: 'string', description: 'Absolute http(s) URL' } },
    required: ['url'],
  },
}

const saveEnrichmentTool: Anthropic.Tool = {
  name: 'save_enrichment',
  description: 'Save the verified facts about this tennis facility. Call exactly once when done. Omit any field you could not verify — never guess or copy data from a different organization.',
  input_schema: {
    type: 'object' as const,
    properties: {
      venue_name: { type: 'string', description: 'Official name of the organization / facility operating the courts' },
      kind: { type: 'string', enum: ['public_park', 'tennis_center', 'club', 'school', 'residential', 'hotel', 'commercial', 'other'] },
      address: { type: 'string', description: 'Street address, city, state ZIP' },
      phone: { type: 'string' },
      website: { type: 'string', description: 'Official website (not Facebook / Yelp / Google Maps)' },
      opening_hours: { type: 'string', description: 'Short human text, e.g. "Mon–Fri 8am–10pm, Sat–Sun 8am–8pm" or "Dawn to dusk"' },
      court_count: { type: 'integer', description: 'Total number of tennis courts at this facility' },
      surface: { type: 'string', enum: ['hard', 'clay', 'grass', 'carpet', 'synthetic'] },
      has_indoor: { type: 'boolean' },
      has_outdoor: { type: 'boolean' },
      lit: { type: 'boolean', description: 'Courts have lights for night play' },
      access: { type: 'string', enum: ['public', 'private', 'members', 'customers'] },
      fee: { type: 'boolean', description: 'true if you must pay (court fee / membership) to play' },
      description: { type: 'string', description: '1–2 sentences: what this place is, what it offers (lessons, reservations, leagues, pro shop…)' },
      source_urls: { type: 'array', items: { type: 'string' }, description: 'URLs where the facts were found' },
      notes: { type: 'string', description: 'Anything uncertain, e.g. "court count from 2023 article"' },
    },
    required: ['source_urls'],
  },
}

async function runAgentForItem(client: Anthropic, city: CityConfig, item: QueueItem): Promise<EnrichmentResult | null> {
  const known = Object.entries(item.known).map(([k, v]) => `  - ${k}: ${typeof v === 'string' ? v : JSON.stringify(v)}`).join('\n')
  const where = item.address ?? `${item.lat.toFixed(5)}, ${item.lng.toFixed(5)}`

  const system = `You research tennis facilities for a court directory in ${city.label}, ${city.region}, ${city.country}.
You get one facility at a time: its location, what we already know, and what is missing.
Find the organization that operates the courts at that exact location and extract facts about it.
Rules:
- Search the web with web_search; read pages with fetch_page when a snippet is not enough.
- Prefer official sources: the operator's own website, the city parks department, school district, HOA site. Court directories (tennis-austin.com, playtennis, tennispronow, globaltennisnetwork) are acceptable for court count / surface / lights.
- Make sure the facts refer to THIS location, not another branch of the same operator.
- Keep description to 1–2 sentences. Keep opening_hours short.
- Finish by calling save_enrichment exactly once. Omit fields you could not verify.`

  const user = item.needs_identification
    ? `Unidentified tennis courts (${item.member_count} court polygon(s) on the map, ~${item.court_count_osm} courts total).
Location: ${where} (lat ${item.lat.toFixed(5)}, lng ${item.lng.toFixed(5)}), ${city.label}, ${city.region}.
Map: ${item.hints.google_maps_url}
${known ? `Already known:\n${known}\n` : ''}
Task: figure out which park / club / school / complex these courts belong to (search e.g. "tennis courts near <street name> ${city.label}", the street name from the address, or nearby landmarks), then collect: ${WANTED_FIELDS.join(', ')}.`
    : `Facility: "${item.name}" (${KIND_LABEL[item.kind]}), ${item.member_count} court polygon(s) on the map (~${item.court_count_osm} courts).
Location: ${where} (lat ${item.lat.toFixed(5)}, lng ${item.lng.toFixed(5)}), ${city.label}, ${city.region}.
${known ? `Already known:\n${known}\n` : ''}
Missing: ${item.missing.join(', ')}.
Task: find the missing facts for this facility. Start with web_search: ${item.name} ${city.label} tennis courts.`

  const messages: Anthropic.MessageParam[] = [{ role: 'user', content: user }]
  const tools: Anthropic.ToolUnion[] = [
    {
      type: 'web_search_20250305',
      name: 'web_search',
      max_uses: 4,
      user_location: { type: 'approximate', city: city.label, region: city.region, country: city.country, timezone: city.timezone },
    },
    fetchPageTool,
    saveEnrichmentTool,
  ]

  let pages = 0
  let result: EnrichmentResult | null = null

  for (let turn = 0; turn < MAX_TURNS && !result; turn++) {
    const response = await client.messages.create({ model: 'claude-sonnet-4-6', max_tokens: 3000, system, tools, messages })
    messages.push({ role: 'assistant', content: response.content })

    if (response.stop_reason === 'pause_turn') continue // server tool still running — resend as-is
    if (response.stop_reason !== 'tool_use') break

    const toolResults: Anthropic.ToolResultBlockParam[] = []
    for (const block of response.content) {
      if (block.type !== 'tool_use') continue
      if (block.name === 'fetch_page') {
        const { url } = block.input as { url: string }
        let content: string
        if (pages >= MAX_PAGES_PER_ITEM) {
          content = 'Page budget exhausted. Call save_enrichment now with what you have verified.'
        } else {
          pages++
          process.stdout.write(`       fetch: ${url.slice(0, 90)}\n`)
          content = await fetchPage(url)
        }
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content })
      } else if (block.name === 'save_enrichment') {
        result = block.input as EnrichmentResult
        toolResults.push({ type: 'tool_result', tool_use_id: block.id, content: 'Saved.' })
      }
    }
    if (toolResults.length > 0) messages.push({ role: 'user', content: toolResults })
  }

  if (!result) {
    // Force a structured answer from whatever was gathered
    const final = await client.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 1500,
      system,
      tools: [saveEnrichmentTool],
      tool_choice: { type: 'tool', name: 'save_enrichment' },
      messages: [...messages, { role: 'user', content: 'Time is up. Call save_enrichment with only the facts you verified.' }],
    })
    const block = final.content.find((b) => b.type === 'tool_use')
    if (block && block.type === 'tool_use') result = block.input as EnrichmentResult
  }
  return result
}

async function cmdAgent(sb: SupabaseClient, city: CityConfig, flags: Record<string, string | boolean>) {
  const dryRun = flags['dry-run'] === true
  const limit = flagNumber(flags, 'limit', 25)
  const client = new Anthropic({ apiKey: requireEnv('ANTHROPIC_API_KEY') })

  const groups = await loadGroups(sb, city)
  const queue = buildQueue(city, groups, flags['include-private'] === true)
  const items = queue.items.slice(0, limit)
  console.log(`\n🤖 Agent enrichment for ${city.label}: ${items.length} of ${queue.items.length} queued items${dryRun ? ' [DRY RUN — results written to file only]' : ''}\n`)

  for (const [i, item] of items.entries()) {
    console.log(`[${i + 1}/${items.length}] ${item.name ?? '(unidentified)'} — missing: ${item.needs_identification ? 'identification' : item.missing.join(', ')}`)
    try {
      const raw = await runAgentForItem(client, city, item)
      item.result = raw ? sanitizeResult(raw) : null
      const found = item.result ? Object.keys(item.result).filter((k) => k !== 'source_urls' && item.result![k as keyof EnrichmentResult] != null) : []
      console.log(`     → ${found.length ? found.join(', ') : 'nothing verified'}`)
    } catch (e) {
      console.error(`     ❌ ${e instanceof Error ? e.message : String(e)}`)
    }
    await sleep(1_500)
  }

  const out = typeof flags['out'] === 'string' ? flags['out'] : defaultQueuePath(city).replace(/\.json$/, '-agent.json')
  fs.mkdirSync(path.dirname(out), { recursive: true })
  fs.writeFileSync(out, JSON.stringify({ ...queue, items }, null, 2))
  console.log(`\n📝 Results saved to ${out}`)

  await applyResults(sb, items.filter((i) => i.result), { overwrite: false, dryRun, sourceType: 'browser_agent' })
}

// ═══════════════════════════════════════════════════════════════════════════════
// stats
// ═══════════════════════════════════════════════════════════════════════════════

async function cmdStats(sb: SupabaseClient, city: CityConfig) {
  const groups = await loadGroups(sb, city)
  const venues = await loadVenues(sb, city)
  const pct = (n: number) => `${n} (${groups.length ? Math.round((n / groups.length) * 100) : 0}%)`
  const publicGroups = groups.filter((g) => !PRIVATE_KINDS.has(g.kind))
  console.log(`\n📊 ${city.label} venue catalog`)
  console.log(`   raw court records:       ${venues.length} (${venues.filter((v) => v.group_id).length} attached to a group)`)
  console.log(`   organizations (groups):  ${groups.length}`)
  console.log(`     named:                 ${pct(groups.filter((g) => g.name && !isGenericName(g.name)).length)}`)
  console.log(`     public / non-private:  ${publicGroups.length}`)
  console.log(`     with phone:            ${pct(groups.filter((g) => g.phone).length)}`)
  console.log(`     with website:          ${pct(groups.filter((g) => g.website).length)}`)
  console.log(`     with hours:            ${pct(groups.filter((g) => g.opening_hours).length)}`)
  console.log(`     with court count:      ${pct(groups.filter((g) => g.court_count).length)}`)
  console.log(`     with surface:          ${pct(groups.filter((g) => g.surface).length)}`)
  console.log(`     with description:      ${pct(groups.filter((g) => g.description).length)}`)
  console.log(`     still need enrichment: ${groups.filter((g) => g.needs_enrichment).length}`)
  const byKind = new Map<string, number>()
  for (const g of groups) byKind.set(g.kind, (byKind.get(g.kind) ?? 0) + 1)
  console.log(`   by kind: ${[...byKind.entries()].map(([k, n]) => `${k}=${n}`).join(', ')}`)
}

// ═══════════════════════════════════════════════════════════════════════════════
// entry
// ═══════════════════════════════════════════════════════════════════════════════

async function main() {
  const { command, positional, flags } = parseArgs(process.argv.slice(2))
  if (command === 'help' || flags['help'] === true) {
    console.log(fs.readFileSync(new URL(import.meta.url), 'utf-8').split('*/')[0]!.replace(/^\/\*\*\n/, ''))
    return
  }
  const sb = supabaseAdmin()
  const city = cityFromFlags(flags)

  switch (command) {
    case 'cluster':
      await cmdCluster(sb, city, flags)
      break
    case 'identify':
      await cmdIdentify(sb, city, flags)
      break
    case 'queue':
      await cmdQueue(sb, city, flags)
      break
    case 'apply':
      await cmdApply(sb, positional, flags)
      break
    case 'agent':
      await cmdAgent(sb, city, flags)
      break
    case 'stats':
      await cmdStats(sb, city)
      break
    case 'all':
      await cmdCluster(sb, city, flags)
      await cmdIdentify(sb, city, flags)
      await cmdQueue(sb, city, flags)
      await cmdStats(sb, city)
      break
    default:
      throw new Error(`Unknown command "${command}". Run with --help.`)
  }
}

main().catch((err) => {
  console.error('❌', err instanceof Error ? err.message : err)
  process.exit(1)
})
