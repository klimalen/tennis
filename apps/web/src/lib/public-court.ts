import type { SupabaseClient } from '@supabase/supabase-js'
import { mergeVenueDisplay, type LinkedCourtProfile } from '@/lib/court/merge-venue-display'

const LINKED_PROFILE_SELECT =
  'username, full_name, phone, website, bio, address, opening_hours, account_kind, city_name, court_count, preferred_surfaces, has_indoor, has_outdoor, lit, fee_hour_min, fee_hour_max'

const COURT_COLUMNS = `
  id, name, kind, lat, lng, address, phone, website, opening_hours, description,
  court_count, court_count_osm, surface, lit, has_indoor, has_outdoor, access, fee,
  fee_hour_min, fee_hour_max, google_maps_uri,
  linked_profile:profiles!profile_id ( ${LINKED_PROFILE_SELECT} )
`

export interface PublicCourt {
  id: string
  name: string
  kind: string
  lat: number
  lng: number
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  description: string | null
  court_count: number | null
  surface: string | null
  surfaces: string[]
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  access: string | null
  fee: boolean | null
  fee_hour_min: number | null
  fee_hour_max: number | null
  google_maps_uri: string | null
  profile_username: string | null
  city_name: string | null
  court_verified: boolean
}

interface CourtRow {
  id: string
  name: string | null
  kind: string
  lat: number
  lng: number
  address: string | null
  phone: string | null
  website: string | null
  opening_hours: string | null
  description: string | null
  court_count: number | null
  court_count_osm: number
  surface: string | null
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  access: string | null
  fee: boolean | null
  fee_hour_min: number | null
  fee_hour_max: number | null
  google_maps_uri: string | null
  linked_profile: LinkedCourtProfile | LinkedCourtProfile[] | null
}

function toCourt(row: CourtRow): PublicCourt | null {
  if (row.kind === 'residential') return null
  const linkedRaw = row.linked_profile
  const linked = Array.isArray(linkedRaw) ? linkedRaw[0] ?? null : linkedRaw
  const catalog = {
    id: row.id,
    name: row.name?.trim() || 'Tennis courts',
    kind: row.kind,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    phone: row.phone,
    website: row.website,
    opening_hours: row.opening_hours,
    description: row.description,
    court_count: row.court_count ?? (row.court_count_osm > 0 ? row.court_count_osm : null),
    surface: row.surface,
    surfaces: row.surface ? [row.surface] : [] as string[],
    lit: row.lit,
    has_indoor: row.has_indoor,
    has_outdoor: row.has_outdoor,
    access: row.access,
    fee: row.fee,
    fee_hour_min: row.fee_hour_min,
    fee_hour_max: row.fee_hour_max,
    google_maps_uri: row.google_maps_uri,
    profile_username: null as string | null,
    city_name: null as string | null,
    court_verified: false,
  }
  return mergeVenueDisplay(catalog, linked)
}

export async function loadPublicCourt(
  supabase: SupabaseClient,
  id: string,
): Promise<{ court: PublicCourt } | { redirectTo: string } | null> {
  const { data, error } = await supabase.from('venue_groups').select(COURT_COLUMNS).eq('id', id).maybeSingle()
  if (error || !data) {
    const redirect = await supabase.from('venue_group_redirects').select('new_id').eq('old_id', id).maybeSingle()
    const nextId = redirect.data?.new_id as string | undefined
    if (redirect.error || !nextId || nextId === id) return null
    return { redirectTo: nextId }
  }
  const court = toCourt(data as unknown as CourtRow)
  if (!court) return null
  return { court }
}
