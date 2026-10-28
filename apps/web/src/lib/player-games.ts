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
  const chatSelect = (ids: string[]) =>
    ids.length === 0
      ? Promise.resolve({ data: [] as { id: string; game_id: string }[], error: null })
      : supabase.from('conversations').select('id, game_id').eq('kind', 'game').in('game_id', ids)

  // Joined games and both chat lookups only need ids we already have.
  const [joinedResult, createdChats, joinedChats] = await Promise.all([
    joinedIds.length > 0
      ? supabase
          .from('games')
          .select(GAME_COLUMNS)
          .in('id', joinedIds)
          .neq('status', 'cancelled')
          .neq('status', 'draft')
      : Promise.resolve({ data: [] as NonNullable<typeof created>, error: null }),
    chatSelect([...createdIds]),
    chatSelect(joinedIds),
  ])
  if (joinedResult.error) throw joinedResult.error
  if (createdChats.error) throw createdChats.error
  if (joinedChats.error) throw joinedChats.error

  const chatByGame = new Map<string, string>()
  for (const chat of [...(createdChats.data ?? []), ...(joinedChats.data ?? [])]) {
    chatByGame.set(chat.game_id, chat.id)
  }

  const createdGames: ScheduleGame[] = (created ?? []).map((game) => ({
    ...(game as Omit<ScheduleGame, 'participation' | 'chatId'>),
    participation: 'creator',
    chatId: chatByGame.get(game.id as string) ?? null,
  }))
  const joinedGames: ScheduleGame[] = (joinedResult.data ?? []).map((game) => ({
    ...(game as Omit<ScheduleGame, 'participation' | 'chatId'>),
    participation: statusByGame.get(game.id as string) === 'invited' ? 'invited' : 'accepted',
    chatId: chatByGame.get(game.id as string) ?? null,
  }))

  return [...createdGames, ...joinedGames]
}

export async function playedGamesCount(supabase: SupabaseClient, playerId: string, fallback: number): Promise<number> {
  const { data, error } = await supabase.rpc('played_games_count', { p_player_id: playerId })
  if (error || typeof data !== 'number') return fallback
  return data
}
