import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
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

  const { data, error } = await supabase
    .from('game_participants')
    .update({ status, responded_at: new Date().toISOString() })
    .eq('game_id', gameId)
    .eq('player_id', user.id)
    .select('player_id')

  if (error) return apiError(500, 'Could not update the invitation', error)
  if (!data?.length) return NextResponse.json({ error: 'Invitation not found' }, { status: 404 })
  return NextResponse.json({ ok: true })
}
