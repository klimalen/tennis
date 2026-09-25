import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: gameId } = await params

  const { data: game } = await supabase
    .from('games')
    .select('id, is_open, max_players, creator_id, scheduled_at, format, neighborhood')
    .eq('id', gameId)
    .single()

  if (!game || !game.is_open) {
    return NextResponse.json({ error: 'Game not found or not public' }, { status: 404 })
  }

  const { data: joined, error } = await supabase.rpc('join_open_game', { p_game_id: gameId })

  if (error) {
    if (error.message.includes('game full')) {
      return NextResponse.json({ error: 'Game is full' }, { status: 409 })
    }
    if (error.message.includes('game not open')) {
      return NextResponse.json({ error: 'Game not found or not public' }, { status: 404 })
    }
    return apiError(500, 'Could not join the game', error)
  }

  if (joined === 'already') {
    return NextResponse.json({ ok: true, already: true })
  }

  if (game.creator_id !== user.id) {
    const { data: convId } = await supabase
      .rpc('shared_conversation_id', { other_user_id: game.creator_id })

    if (convId) {
      const snapshot = JSON.stringify({
        scheduled_at: game.scheduled_at,
        format: game.format,
        location: game.neighborhood ?? null,
        joined: true,
      })
      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        body: snapshot,
        type: 'game_invite',
        game_id: gameId,
      })
    }
  }

  return NextResponse.json({ ok: true })
}
