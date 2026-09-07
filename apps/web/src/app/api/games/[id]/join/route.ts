import { createClient } from '@/lib/supabase/server'
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

  const { data: existing } = await supabase
    .from('game_participants')
    .select('player_id')
    .eq('game_id', gameId)
    .eq('player_id', user.id)
    .maybeSingle()

  if (existing) {
    return NextResponse.json({ ok: true, already: true })
  }

  const { count } = await supabase
    .from('game_participants')
    .select('*', { count: 'exact', head: true })
    .eq('game_id', gameId)
    .in('status', ['accepted', 'invited'])

  if ((count ?? 0) >= game.max_players) {
    return NextResponse.json({ error: 'Game is full' }, { status: 409 })
  }

  const { error } = await supabase
    .from('game_participants')
    .insert({ game_id: gameId, player_id: user.id, status: 'accepted' })

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

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
