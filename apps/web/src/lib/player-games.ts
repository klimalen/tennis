import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleGame } from '@/lib/schedule'

const GAME_COLUMNS = 'id, scheduled_at, duration_minutes, format, neighborhood, is_open, status, creator_id'

export async function loadPlayerGames(supabase: SupabaseClient, playerId: string): Promise<ScheduleGame[]> {
  const [{ data: created }, { data: participations }] = await Promise.all([
    supabase
      .from('games')
      .select(GAME_COLUMNS)
      .eq('creator_id', playerId)
      .neq('status', 'cancelled')
      .neq('status', 'draft'),
    supabase
      .from('game_participants')
      .select('game_id')
      .eq('player_id', playerId)
      .eq('status', 'accepted'),
  ])

  const createdIds = new Set((created ?? []).map((game) => game.id as string))
  const joinedIds = (participations ?? [])
    .map((row) => row.game_id as string)
    .filter((id) => !createdIds.has(id))

  const { data: joined } = joinedIds.length > 0
    ? await supabase
        .from('games')
        .select(GAME_COLUMNS)
        .in('id', joinedIds)
        .neq('status', 'cancelled')
        .neq('status', 'draft')
    : { data: [] }

  return [...(created ?? []), ...(joined ?? [])] as ScheduleGame[]
}

export async function playedGamesCount(supabase: SupabaseClient, playerId: string, fallback: number): Promise<number> {
  const { data, error } = await supabase.rpc('played_games_count', { p_player_id: playerId })
  if (error || typeof data !== 'number') return fallback
  return data
}
