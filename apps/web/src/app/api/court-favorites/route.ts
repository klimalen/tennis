import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { mergeVenueDisplay, type LinkedCourtProfile } from '@/lib/court/merge-venue-display'
import { NextResponse } from 'next/server'

const LINKED_PROFILE_SELECT =
  'username, full_name, phone, website, bio, address, opening_hours, account_kind, city_name, court_count, preferred_surfaces, has_indoor, has_outdoor, lit, fee_hour_min, fee_hour_max'

const VENUE_COLUMNS = `id, name, kind, lat, lng, address, phone, website, opening_hours, description, court_count, court_count_osm, member_count, surface, lit, has_indoor, has_outdoor, access, fee, fee_hour_min, fee_hour_max, google_maps_uri, confidence, linked_profile:profiles!profile_id(${LINKED_PROFILE_SELECT})`

interface FavoriteVenue {
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
  member_count: number
  surface: string | null
  lit: boolean | null
  has_indoor: boolean | null
  has_outdoor: boolean | null
  access: string | null
  fee: boolean | null
  fee_hour_min: number | null
  fee_hour_max: number | null
  google_maps_uri: string | null
  confidence: 'low' | 'medium' | 'high'
  linked_profile: LinkedCourtProfile | LinkedCourtProfile[] | null
}

function toCard(venue: FavoriteVenue) {
  const linkedRaw = venue.linked_profile
  const linked = Array.isArray(linkedRaw) ? linkedRaw[0] ?? null : linkedRaw
  const catalog = {
    id: venue.id,
    osm_id: null as string | null,
    name: venue.name ?? 'Tennis Courts',
    kind: venue.kind,
    lat: venue.lat,
    lng: venue.lng,
    address: venue.address,
    surface: venue.surface,
    surfaces: venue.surface ? [venue.surface] : [] as string[],
    court_count: venue.court_count ?? (venue.court_count_osm > 0 ? venue.court_count_osm : null),
    lit: venue.lit,
    access: venue.access,
    fee: venue.fee,
    fee_hour_min: venue.fee_hour_min,
    fee_hour_max: venue.fee_hour_max,
    website: venue.website,
    phone: venue.phone,
    operator: null as string | null,
    opening_hours: venue.opening_hours,
    description: venue.description,
    has_indoor: venue.has_indoor,
    has_outdoor: venue.has_outdoor,
    google_maps_uri: venue.google_maps_uri,
    member_count: venue.member_count,
    confidence: venue.confidence,
    profile_username: null as string | null,
    city_name: null as string | null,
    court_verified: false,
  }
  return mergeVenueDisplay(catalog, linked)
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ venues: [] })

  const { data, error } = await supabase
    .from('court_favorites')
    .select(`created_at, venue:venue_groups!venue_group_id (${VENUE_COLUMNS})`)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) return apiError(500, 'Could not load saved courts', error)

  const venues = (data ?? []).flatMap((row) => {
    const venue = row.venue as unknown as FavoriteVenue | FavoriteVenue[] | null
    const one = Array.isArray(venue) ? venue[0] : venue
    return one ? [toCard(one)] : []
  })

  return NextResponse.json({ venues })
}

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { venue_group_id?: string }
  const venueGroupId = body.venue_group_id
  if (!venueGroupId) return NextResponse.json({ error: 'venue_group_id is required' }, { status: 400 })

  const { data: group } = await supabase.from('venue_groups').select('id').eq('id', venueGroupId).maybeSingle()
  if (!group) return NextResponse.json({ error: 'This court cannot be saved' }, { status: 400 })

  const { error } = await supabase
    .from('court_favorites')
    .upsert({ user_id: user.id, venue_group_id: venueGroupId }, { onConflict: 'user_id,venue_group_id' })

  if (error) return apiError(500, 'Could not save the court', error)
  return NextResponse.json({ ok: true })
}

export async function DELETE(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { venue_group_id?: string }
  const venueGroupId = body.venue_group_id
  if (!venueGroupId) return NextResponse.json({ error: 'venue_group_id is required' }, { status: 400 })

  const { error } = await supabase
    .from('court_favorites')
    .delete()
    .eq('user_id', user.id)
    .eq('venue_group_id', venueGroupId)

  if (error) return apiError(500, 'Could not remove the court', error)
  return NextResponse.json({ ok: true })
}
