import { createClient } from '@/lib/supabase/server'
import { NextResponse } from 'next/server'

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const body = await request.json() as {
    scheduled_at?: string
    format?: string
    location_name?: string | null
    notes?: string | null
  }

  // Fetch current game to detect if scheduled_at is changing
  const { data: current } = await supabase
    .from('games')
    .select('scheduled_at, format, neighborhood, creator_id')
    .eq('id', id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const { error } = await supabase
    .from('games')
    .update({
      ...(body.scheduled_at && { scheduled_at: body.scheduled_at }),
      ...(body.format && { format: body.format }),
      neighborhood: body.location_name ?? null,
      notes: body.notes ?? null,
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If date/time changed, notify all other participants via chat
  const scheduledAtChanged =
    body.scheduled_at && body.scheduled_at !== current.scheduled_at

  if (scheduledAtChanged) {
    const newScheduledAt = body.scheduled_at!
    const newFormat = body.format ?? current.format
    const newNeighborhood = body.location_name !== undefined ? body.location_name : current.neighborhood

    const snapshot = JSON.stringify({
      scheduled_at: newScheduledAt,
      format: newFormat,
      location: newNeighborhood ?? null,
      updated: true,
    })

    // Get all other participants
    const { data: participants } = await supabase
      .from('game_participants')
      .select('player_id')
      .eq('game_id', id)
      .neq('player_id', user.id)

    for (const p of participants ?? []) {
      const { data: convId, error: convErr } = await supabase
        .rpc('shared_conversation_id', { other_user_id: p.player_id })

      if (convErr || !convId) continue

      await supabase.from('messages').insert({
        conversation_id: convId,
        sender_id: user.id,
        body: snapshot,
        type: 'game_invite',
        game_id: id,
      })
    }
  }

  return NextResponse.json({ ok: true })
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params

  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', id)
    .eq('creator_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
