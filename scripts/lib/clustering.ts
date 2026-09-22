/**
 * Group raw court records into facilities ("organizations").
 *
 * Two courts belong together when they sit inside the same enclosing OSM feature
 * (park, club, school…) or are physically adjacent (single-linkage within LINK_M).
 * Adjacency never merges across two *different* small facilities.
 */

import { contactsFromTags, findParent, type ParentIndex, type ParentMatch } from './osm-parents'
import {
  centroid,
  haversineM,
  normalizeAccess,
  normalizePhone,
  normalizeSurface,
  normalizeWebsite,
  PRIVATE_NAME_RE,
  type SourceRef,
  UnionFind,
  type VenueKind,
} from './venue-common'

/** Courts closer than this belong to the same facility (a court is ~37 × 18 m). */
export const LINK_M = 120
/** OSM parents larger than this (neighbourhoods) name the group but don't merge courts across it. */
export const MERGE_PARENT_MAX_AREA_M2 = 2_500_000
/**
 * Clusters whose existing groups carry the same organization name and sit within this
 * distance are one facility split by a road / parking lot (e.g. two banks of courts
 * at a country club). Enrichment gives both halves the same name; re-clustering merges them.
 */
export const SAME_NAME_MERGE_M = 600

const GENERIC_NAMES = new Set(['tennis court', 'tennis courts', 'court', 'courts', 'tennis'])
export const STREET_ADDRESS_RE =
  /^\d+\s+\S+.*\b(rd|road|st|street|dr|drive|ln|lane|blvd|boulevard|ave|avenue|way|trail|trl|cir|circle|pkwy|parkway|hwy|highway|loop|pass|path|bend|cove|cv|pl|place)\b\.?$/i

export function isGenericName(name: string | null | undefined): boolean {
  if (!name) return true
  return GENERIC_NAMES.has(name.trim().toLowerCase())
}

const NAME_STOPWORDS = /\b(the|park|tennis|courts?|center|centre|club|country|district|neighborhood|hoa|of|at|and|complex|sports?)\b/g

/** Loose equality of organization names: same significant tokens, ignoring generic words. */
export function namesSimilar(a: string, b: string): boolean {
  const norm = (s: string) =>
    s.toLowerCase().replace(/\(.*?\)/g, ' ').replace(/[^a-z0-9 ]/g, ' ').replace(NAME_STOPWORDS, ' ').replace(/\s+/g, ' ').trim()
  const na = norm(a)
  const nb = norm(b)
  if (!na || !nb) return false
  if (na === nb) return true
  const ta = new Set(na.split(' '))
  const tb = new Set(nb.split(' '))
  // Substring match only when the shorter name is specific enough ("great hills" ⊂ "great hills golf")
  if (Math.min(ta.size, tb.size) >= 2 && (na.includes(nb) || nb.includes(na))) return true
  let common = 0
  for (const t of ta) if (tb.has(t) && t.length > 2) common++
  return common >= Math.min(2, Math.min(ta.size, tb.size))
}

export function mostCommon<T>(values: (T | null | undefined)[]): T | null {
  const counts = new Map<T, number>()
  for (const v of values) if (v != null) counts.set(v, (counts.get(v) ?? 0) + 1)
  let best: T | null = null
  let bestN = 0
  for (const [v, n] of counts) {
    if (n > bestN) {
      best = v
      bestN = n
    }
  }
  return best
}

export function firstNonNull<T>(values: (T | null | undefined)[]): T | null {
  for (const v of values) if (v != null && v !== '') return v
  return null
}

export interface VenueRow {
  id: string
  osm_id: string | null
  name: string
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
  sources: SourceRef[] | null
  group_id: string | null
}

export interface Cluster {
  members: VenueRow[]
  parent: ParentMatch | null
}

export function buildClusters(venues: VenueRow[], parents: ParentIndex): Cluster[] {
  const parentOf = venues.map((v) => findParent(parents, v.lat, v.lng))
  const uf = new UnionFind(venues.length)

  // 1. Same enclosing facility → same group (unless the "facility" is a whole neighbourhood)
  const byParent = new Map<string, number[]>()
  parentOf.forEach((p, i) => {
    if (!p || p.how === 'near') return
    if (p.feature.areaM2 > MERGE_PARENT_MAX_AREA_M2) return
    const list = byParent.get(p.feature.osmId) ?? []
    list.push(i)
    byParent.set(p.feature.osmId, list)
  })
  for (const idxs of byParent.values()) for (let k = 1; k < idxs.length; k++) uf.union(idxs[0]!, idxs[k]!)

  // 2. Physical adjacency — but never across two *different* small facilities
  for (let i = 0; i < venues.length; i++) {
    const a = venues[i]!
    for (let j = i + 1; j < venues.length; j++) {
      const b = venues[j]!
      if (Math.abs(a.lat - b.lat) > 0.002 || Math.abs(a.lng - b.lng) > 0.002) continue
      if (haversineM(a.lat, a.lng, b.lat, b.lng) > LINK_M) continue
      const pa = parentOf[i]
      const pb = parentOf[j]
      const bothInsideDifferent =
        pa && pb && pa.how === 'inside' && pb.how === 'inside' && pa.feature.osmId !== pb.feature.osmId &&
        pa.feature.areaM2 <= MERGE_PARENT_MAX_AREA_M2 && pb.feature.areaM2 <= MERGE_PARENT_MAX_AREA_M2
      if (bothInsideDifferent) continue
      uf.union(i, j)
    }
  }

  const groups = new Map<number, number[]>()
  for (let i = 0; i < venues.length; i++) {
    const r = uf.find(i)
    const list = groups.get(r) ?? []
    list.push(i)
    groups.set(r, list)
  }

  return [...groups.values()].map((idxs) => {
    const members = idxs.map((i) => venues[i]!)
    // Representative parent: most common containing match among members
    const matches = idxs.map((i) => parentOf[i]).filter((p): p is ParentMatch => p != null)
    const key =
      mostCommon(matches.filter((m) => m.how !== 'near').map((m) => m.feature.osmId)) ??
      mostCommon(matches.map((m) => m.feature.osmId))
    const parent = matches.find((m) => m.feature.osmId === key) ?? null
    return { members, parent }
  })
}

/**
 * Merge geometric clusters that already belong to identically named organizations
 * (via their members' current `group_id`) and lie within SAME_NAME_MERGE_M of each other.
 * Names come from enrichment, so this only kicks in on re-runs. Idempotent.
 */
export function mergeClustersBySameName(
  clusters: Cluster[],
  groups: Map<string, { name: string | null; kind: VenueKind }>,
  maxM = SAME_NAME_MERGE_M,
): { clusters: Cluster[]; merged: number } {
  const groupOf = (c: Cluster) => {
    const gid = mostCommon(c.members.map((v) => v.group_id))
    const g = gid ? groups.get(gid) : null
    return g && g.name && !isGenericName(g.name) ? g : null
  }
  const owners = clusters.map(groupOf)
  const centers = clusters.map((c) => centroid(c.members))
  const uf = new UnionFind(clusters.length)
  let merged = 0

  for (let i = 0; i < clusters.length; i++) {
    const ga = owners[i]
    if (!ga) continue
    for (let j = i + 1; j < clusters.length; j++) {
      const gb = owners[j]
      if (!gb) continue
      // "South Austin Tennis Center" vs "South Austin Neighborhood Park" share a park but not an operator
      if (ga.kind !== gb.kind && ga.kind !== 'unknown' && gb.kind !== 'unknown') continue
      const a = centers[i]!
      const b = centers[j]!
      if (Math.abs(a.lat - b.lat) > 0.01 || Math.abs(a.lng - b.lng) > 0.01) continue
      if (haversineM(a.lat, a.lng, b.lat, b.lng) > maxM) continue
      if (!namesSimilar(ga.name!, gb.name!)) continue
      if (uf.find(i) !== uf.find(j)) {
        uf.union(i, j)
        merged++
      }
    }
  }
  if (merged === 0) return { clusters, merged }

  const byRoot = new Map<number, Cluster>()
  for (let i = 0; i < clusters.length; i++) {
    const r = uf.find(i)
    const c = clusters[i]!
    const acc = byRoot.get(r)
    if (!acc) {
      byRoot.set(r, { members: [...c.members], parent: c.parent })
    } else {
      acc.members.push(...c.members)
      // Prefer a parent that truly contains courts over a nearby one
      if (!acc.parent || (acc.parent.how === 'near' && c.parent && c.parent.how !== 'near')) acc.parent = c.parent
    }
  }
  return { clusters: [...byRoot.values()], merged }
}

export interface DerivedGroup {
  name: string | null
  kind: VenueKind
  lat: number
  lng: number
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  description: string | null
  court_count_osm: number
  member_count: number
  surface: string | null
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  access: 'public' | 'private' | 'members' | 'customers' | null
  fee: boolean | null
  osm_parent_id: string | null
  parent_confidence: 'low' | 'medium' | 'high'
}

/** Data derivable purely from member rows + the OSM parent, without external calls. */
export function deriveGroupFields(c: Cluster): DerivedGroup {
  const m = c.members
  const center = centroid(m)
  const memberNames = m.map((v) => v.name).filter((n) => !isGenericName(n) && !STREET_ADDRESS_RE.test(n))
  const parentTags = c.parent?.feature.tags ?? {}
  const parentContacts = c.parent ? contactsFromTags(parentTags) : null

  const name = c.parent?.feature.name ?? mostCommon(memberNames)
  let kind: VenueKind = c.parent?.feature.kind ?? 'unknown'
  if (kind === 'unknown' && name) {
    if (PRIVATE_NAME_RE.test(name)) kind = 'residential'
    else if (/tennis (center|centre)/i.test(name)) kind = 'tennis_center'
    else if (/club/i.test(name)) kind = 'club'
    else if (/park/i.test(name)) kind = 'public_park'
  }
  if (kind === 'unknown' && memberNames.some((n) => PRIVATE_NAME_RE.test(n))) kind = 'residential'

  let access = normalizeAccess(mostCommon(m.map((v) => v.access))) ?? normalizeAccess(parentTags['access'] ?? null)
  if (!access && kind === 'residential') access = 'private'
  if (!access && kind === 'public_park') access = 'public'

  const fee = mostCommon(m.map((v) => v.fee)) ?? (parentTags['fee'] === 'yes' ? true : parentTags['fee'] === 'no' ? false : null)

  return {
    name: name ?? null,
    kind,
    lat: center.lat,
    lng: center.lng,
    address: firstNonNull(m.map((v) => v.address)) ?? parentContacts?.address ?? null,
    phone: normalizePhone(firstNonNull(m.map((v) => v.phone)) ?? parentContacts?.phone),
    website: normalizeWebsite(firstNonNull(m.map((v) => v.website)) ?? parentContacts?.website),
    opening_hours: firstNonNull(m.map((v) => v.opening_hours)) ?? parentContacts?.opening_hours ?? null,
    description: firstNonNull(m.map((v) => v.description)),
    court_count_osm: m.reduce((s, v) => s + (v.court_count ?? 1), 0),
    member_count: m.length,
    surface: normalizeSurface(mostCommon(m.map((v) => normalizeSurface(v.surface)))),
    lit: m.some((v) => v.lit === true) ? true : null,
    has_indoor: m.some((v) => v.has_indoor === true) ? true : null,
    has_outdoor: m.some((v) => v.has_outdoor === true) ? true : null,
    access,
    fee,
    osm_parent_id: c.parent?.feature.osmId ?? null,
    parent_confidence: c.parent ? (c.parent.how === 'inside' ? 'medium' : 'low') : 'low',
  }
}
