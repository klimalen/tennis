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
    .select('id, is_open')
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
    if (error.message.includes('court cannot join')) {
      return NextResponse.json({ error: 'A court organises games and does not take a spot' }, { status: 403 })
    }
    return apiError(500, 'Could not join the game', error)
  }

  if (joined === 'already') {
    return NextResponse.json({ ok: true, already: true })
  }

  // The seat change itself writes "joined the game" into the game chat
  // and into the direct chat with the organiser, when one exists.
  return NextResponse.json({ ok: true })
}
