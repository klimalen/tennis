import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    scheduled_at: string
    format: string
    location_name?: string
    notes?: string
    is_open?: boolean
  }

  const { scheduled_at, format, location_name, notes, is_open } = body

  if (!scheduled_at || !format) {
    return NextResponse.json({ error: 'scheduled_at and format are required' }, { status: 400 })
  }

  const gameId = crypto.randomUUID()
  const max_players = format === 'singles' ? 2 : 4

  const { error: gameErr } = await supabase
    .from('games')
    .insert({
      id: gameId,
      creator_id: user.id,
      format,
      scheduled_at,
      neighborhood: location_name ?? null,
      notes: notes ?? null,
      is_open: is_open ?? false,
      max_players,
      status: 'confirmed',
    })

  if (gameErr) {
    console.error('[POST /api/games] insert error:', gameErr)
    return NextResponse.json({ error: gameErr.message }, { status: 500 })
  }

  const { error: participantErr } = await supabase
    .from('game_participants')
    .insert({ game_id: gameId, player_id: user.id, status: 'accepted' })

  if (participantErr) {
    console.error('[POST /api/games] participant insert error:', participantErr)
  }

  return NextResponse.json({ id: gameId }, { status: 201 })
}
