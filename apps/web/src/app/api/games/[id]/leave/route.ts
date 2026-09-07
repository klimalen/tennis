import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

// POST /api/games/:id/leave
// Sets current user's participation status to 'declined'.
// If no participants remain with status 'invited' or 'accepted', the game is auto-deleted.
export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id: gameId } = await params

  // Set status to declined
  const { error } = await supabase
    .from('game_participants')
    .update({ status: 'declined', responded_at: new Date().toISOString() })
    .eq('game_id', gameId)
    .eq('player_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Check if anyone is still in (invited or accepted)
  const { data: remaining } = await supabase
    .from('game_participants')
    .select('player_id')
    .eq('game_id', gameId)
    .in('status', ['invited', 'accepted'])

  if (!remaining || remaining.length === 0) {
    // Everyone left — auto-delete
    await supabase.from('games').delete().eq('id', gameId)
  }

  return NextResponse.json({ ok: true })
}
