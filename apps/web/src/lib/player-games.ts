import type { SupabaseClient } from '@supabase/supabase-js'
import type { ScheduleGame } from '@/lib/schedule'

const GAME_COLUMNS = 'id, scheduled_at, duration_minutes, format, neighborhood, is_open, status, creator_id'

export async function loadPlayerGames(supabase: SupabaseClient, playerId: string): Promise<ScheduleGame[]> {
  const [{ data: created, error: createdError }, { data: participations, error: participationError }] = await Promise.all([
    supabase
      .from('games')
      .select(GAME_COLUMNS)
      .eq('creator_id', playerId)
      .neq('status', 'cancelled')
      .neq('status', 'draft'),
    supabase
      .from('game_participants')
      .select('game_id, status')
      .eq('player_id', playerId)
      .in('status', ['accepted', 'invited']),
  ])
  if (createdError) throw createdError
  if (participationError) throw participationError

  const createdIds = new Set((created ?? []).map((game) => game.id as string))
  const seated = (participations ?? []).filter((row) => !createdIds.has(row.game_id as string))
  const statusByGame = new Map(seated.map((row) => [row.game_id as string, row.status as string]))

  const joinedIds = seated.map((row) => row.game_id as string)
  const { data: joined, error: joinedError } = joinedIds.length > 0
    ? await supabase
        .from('games')
        .select(GAME_COLUMNS)
        .in('id', joinedIds)
        .neq('status', 'cancelled')
        .neq('status', 'draft')
    : { data: [], error: null }
  if (joinedError) throw joinedError

  const createdGames: ScheduleGame[] = (created ?? []).map((game) => ({
    ...(game as Omit<ScheduleGame, 'participation' | 'chatId'>),
    participation: 'creator',
    chatId: null,
  }))
  const joinedGames: ScheduleGame[] = (joined ?? []).map((game) => ({
    ...(game as Omit<ScheduleGame, 'participation' | 'chatId'>),
    participation: statusByGame.get(game.id as string) === 'invited' ? 'invited' : 'accepted',
    chatId: null,
  }))

  const games = [...createdGames, ...joinedGames]
  const ids = games.map((game) => game.id)
  if (ids.length === 0) return games

  const { data: chats, error: chatError } = await supabase
    .from('conversations')
    .select('id, game_id')
    .eq('kind', 'game')
    .in('game_id', ids)
  if (chatError) throw chatError

  const chatByGame = new Map((chats ?? []).map((chat) => [chat.game_id as string, chat.id as string]))
  return games.map((game) => ({ ...game, chatId: chatByGame.get(game.id) ?? null }))
}

export async function playedGamesCount(supabase: SupabaseClient, playerId: string, fallback: number): Promise<number> {
  const { data, error } = await supabase.rpc('played_games_count', { p_player_id: playerId })
  if (error || typeof data !== 'number') return fallback
  return data
}
