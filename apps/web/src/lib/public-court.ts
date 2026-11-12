import type { SupabaseClient } from '@supabase/supabase-js'

const COURT_COLUMNS = `
  id, name, kind, lat, lng, address, phone, website, opening_hours, description,
  court_count, court_count_osm, surface, lit, has_indoor, has_outdoor, access, fee, google_maps_uri,
  linked_profile:profiles!profile_id ( username, phone, website, bio, account_kind )
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
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  access: string | null
  fee: boolean | null
  google_maps_uri: string | null
  profile_username: string | null
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
  google_maps_uri: string | null
  linked_profile: {
    username: string
    phone: string | null
    website: string | null
    bio: string | null
    account_kind: string
  } | {
    username: string
    phone: string | null
    website: string | null
    bio: string | null
    account_kind: string
  }[] | null
}

function toCourt(row: CourtRow): PublicCourt | null {
  if (row.kind === 'residential') return null
  const linkedRaw = row.linked_profile
  const linked = Array.isArray(linkedRaw) ? linkedRaw[0] ?? null : linkedRaw
  const courtProfile = linked?.account_kind === 'court' ? linked : null
  return {
    id: row.id,
    name: row.name?.trim() || 'Tennis courts',
    kind: row.kind,
    lat: row.lat,
    lng: row.lng,
    address: row.address,
    phone: row.phone || courtProfile?.phone || null,
    website: row.website || courtProfile?.website || null,
    opening_hours: row.opening_hours,
    description: courtProfile?.bio?.trim() || row.description,
    court_count: row.court_count ?? (row.court_count_osm > 0 ? row.court_count_osm : null),
    surface: row.surface,
    lit: row.lit,
    has_indoor: row.has_indoor,
    has_outdoor: row.has_outdoor,
    access: row.access,
    fee: row.fee,
    google_maps_uri: row.google_maps_uri,
    profile_username: courtProfile?.username ?? null,
  }
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
