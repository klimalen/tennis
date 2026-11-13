import type { SupabaseClient } from '@supabase/supabase-js'
import type { GameCourt } from '@/lib/game-court'
import type { GameDetail, GameParticipant } from '@/components/games/GameDetailSheet'
import { holdsGameSeat } from '@/lib/schedule'

export function viewerPlaysInGame(
  game: {
    creator_id: string
    participants: { player_id: string; status: string }[]
    creator?: { account_kind?: string | null }
  },
  viewerId: string | null,
) {
  if (!viewerId) return false
  const courtHost = game.creator?.account_kind === 'court'
  if (game.creator_id === viewerId && !courtHost) return true
  return game.participants.some((participant) => participant.player_id === viewerId && holdsGameSeat(participant.status))
}

const COURT_LINKED_PROFILE_SELECT = 'username, full_name, phone, website, address, account_kind'

export const GAME_DETAIL_SELECT = `
  id, format, scheduled_at, duration_minutes, skill_level_min, skill_level_max,
  neighborhood, notes, court_cost_cents, payment, status, max_players, is_open, creator_id,
  court:venue_groups!games_venue_group_id_fkey (
    id, name, address, lit, fee, access, phone, website, google_maps_uri, lat, lng,
    linked_profile:profiles!profile_id ( ${COURT_LINKED_PROFILE_SELECT} )
  ),
  creator:profiles!creator_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed, account_kind),
  city:cities (name),
  participants:game_participants (
    player_id, status,
    profile:profiles!player_id (id, full_name, username, avatar_url, skill_level_self, skill_level_computed, account_kind)
  )
`

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i

export function isUuid(value: string): boolean {
  return UUID.test(value)
}

type LinkedCourtProfile = {
  username: string
  full_name: string | null
  phone: string | null
  website: string | null
  address: string | null
  account_kind: string
}

type CourtRow = Omit<GameCourt, 'profile_username'> & {
  linked_profile?: LinkedCourtProfile | LinkedCourtProfile[] | null
  profile_username?: string | null
}

function pickText(profile: string | null | undefined, catalog: string | null | undefined): string | null {
  const next = profile?.trim()
  if (next) return next
  const prev = catalog?.trim()
  return prev || null
}

function normalizeGameCourt(raw: CourtRow | null | undefined): GameCourt | null {
  if (!raw?.id) return null
  const linkedRaw = raw.linked_profile
  const linkedRow = Array.isArray(linkedRaw) ? linkedRaw[0] ?? null : linkedRaw ?? null
  const linked = linkedRow?.account_kind === 'court' ? linkedRow : null
  return {
    id: raw.id,
    name: pickText(linked?.full_name, raw.name) ?? raw.name,
    address: pickText(linked?.address, raw.address),
    lit: raw.lit,
    fee: raw.fee,
    access: raw.access,
    phone: pickText(linked?.phone, raw.phone),
    website: pickText(linked?.website, raw.website),
    google_maps_uri: raw.google_maps_uri,
    lat: raw.lat,
    lng: raw.lng,
    profile_username: linked?.username ?? raw.profile_username ?? null,
  }
}

export function normalizeGameDetail(data: unknown): GameDetail | null {
  if (!data || typeof data !== 'object') return null
  const row = data as GameDetail & { court: CourtRow | CourtRow[] | null; participants: GameParticipant[] | null }
  const courtRaw = Array.isArray(row.court) ? row.court[0] ?? null : row.court
  return {
    ...row,
    court: normalizeGameCourt(courtRaw),
    participants: row.participants ?? [],
  }
}

export async function loadGameDetailRow(supabase: SupabaseClient, gameId: string): Promise<GameDetail | null> {
  const { data } = await supabase.from('games').select(GAME_DETAIL_SELECT).eq('id', gameId).maybeSingle()
  return normalizeGameDetail(data)
}

export type GameLinkState = 'public' | 'private' | 'gone'

export async function loadGameLinkState(supabase: SupabaseClient, gameId: string): Promise<GameLinkState> {
  const { data, error } = await supabase.rpc('game_link_state', { target: gameId })
  if (error || (data !== 'public' && data !== 'private' && data !== 'gone')) return 'gone'
  return data
}
