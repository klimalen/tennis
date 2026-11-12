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

export const GAME_DETAIL_SELECT = `
  id, format, scheduled_at, duration_minutes, skill_level_min, skill_level_max,
  neighborhood, notes, court_cost_cents, payment, status, max_players, is_open, creator_id,
  court:venue_groups!games_venue_group_id_fkey ( id, name, address, lit, fee, access, phone, website, google_maps_uri, lat, lng ),
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

export function normalizeGameDetail(data: unknown): GameDetail | null {
  if (!data || typeof data !== 'object') return null
  const row = data as GameDetail & { court: GameCourt | GameCourt[] | null; participants: GameParticipant[] | null }
  const court = Array.isArray(row.court) ? row.court[0] ?? null : row.court
  return {
    ...row,
    court: court?.id ? court : null,
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
