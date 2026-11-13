import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { gameEndMs } from '@/lib/game-time'
import { holdsGameSeat } from '@/lib/schedule'
import { NextResponse } from 'next/server'

// POST /api/games/:id/hide
// Soft-dismiss a past game from the current user's schedule only.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: gameId } = await params
  const nowIso = new Date().toISOString()

  const { data: game } = await supabase
    .from('games')
    .select('id, creator_id, scheduled_at, duration_minutes, status')
    .eq('id', gameId)
    .maybeSingle()

  if (!game) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  if (game.status === 'cancelled' || game.status === 'draft') {
    return NextResponse.json({ error: 'Game is not on the schedule' }, { status: 400 })
  }

  const ended = gameEndMs(game.scheduled_at as string, game.duration_minutes as number | null) <= Date.now()
  if (!ended) {
    return NextResponse.json({ error: 'Only past games can be removed from your schedule' }, { status: 400 })
  }

  const { data: existing } = await supabase
    .from('game_participants')
    .select('id, status')
    .eq('game_id', gameId)
    .eq('player_id', user.id)
    .maybeSingle()

  const isCreator = game.creator_id === user.id
  const hasSeat = existing ? holdsGameSeat(existing.status as string) : false

  if (!isCreator && !hasSeat) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  if (existing) {
    const { error } = await supabase
      .from('game_participants')
      .update({ schedule_hidden_at: nowIso })
      .eq('id', existing.id)
      .eq('player_id', user.id)

    if (error) return apiError(500, 'Could not hide the game', error)
    return NextResponse.json({ ok: true })
  }

  // Creator may only appear via games.creator_id (esp. court hosts). Upsert an
  // accepted row so schedule_hidden_at can stick without deleting the game.
  const { error } = await supabase
    .from('game_participants')
    .insert({
      game_id: gameId,
      player_id: user.id,
      status: 'accepted',
      responded_at: nowIso,
      schedule_hidden_at: nowIso,
    })

  if (error) {
    // Race: row appeared between select and insert — update instead.
    if (error.code === '23505') {
      const { error: updateError } = await supabase
        .from('game_participants')
        .update({ schedule_hidden_at: nowIso })
        .eq('game_id', gameId)
        .eq('player_id', user.id)
      if (updateError) return apiError(500, 'Could not hide the game', updateError)
      return NextResponse.json({ ok: true })
    }
    return apiError(500, 'Could not hide the game', error)
  }

  return NextResponse.json({ ok: true })
}
