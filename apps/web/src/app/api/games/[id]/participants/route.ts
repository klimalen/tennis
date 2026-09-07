import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// PATCH /api/games/:id/participants  { status: 'accepted' | 'declined' }
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: gameId } = await params
  const body = await request.json() as { status?: string }
  const { status } = body

  if (status !== 'accepted' && status !== 'declined') {
    return NextResponse.json({ error: 'status must be accepted or declined' }, { status: 400 })
  }

  const { error, count } = await supabase
    .from('game_participants')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('game_id', gameId)
    .eq('player_id', user.id)
    .select('player_id', { count: 'exact' })

  if (error) {
    console.error('[participants PATCH] error:', error)
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
  if (!count || count === 0) {
    console.error('[participants PATCH] no row found for game', gameId, 'player', user.id)
  }
  return NextResponse.json({ ok: true, updated: count ?? 0 })
}
