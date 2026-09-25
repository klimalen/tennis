import { createClient } from '@/lib/supabase/server'
import { parseDurationMinutes } from '@/lib/game-time'
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
    duration_minutes?: number
    format?: string
    location_name?: string | null
    notes?: string | null
    is_open?: boolean
  }
  const duration_minutes = parseDurationMinutes(body.duration_minutes)

  // Fetch current game to detect if scheduled_at is changing
  const { data: current } = await supabase
    .from('games')
    .select('scheduled_at, format, neighborhood, creator_id, is_open')
    .eq('id', id)
    .single()

  if (!current) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const canChangeVisibility = current.creator_id === user.id && typeof body.is_open === 'boolean'
  const opening = canChangeVisibility && body.is_open === true && current.is_open === false
  const closing = canChangeVisibility && body.is_open === false && current.is_open === true

  const { error } = await supabase
    .from('games')
    .update({
      ...(body.scheduled_at && { scheduled_at: body.scheduled_at }),
      ...(duration_minutes ? { duration_minutes } : {}),
      ...(body.format && { format: body.format }),
      neighborhood: body.location_name ?? null,
      notes: body.notes ?? null,
      ...(canChangeVisibility ? { is_open: body.is_open } : {}),
    })
    .eq('id', id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Public games are announced the same way as when one is created as public.
  if (opening) {
    const { data: existing } = await supabase
      .from('posts')
      .select('id')
      .eq('game_id', id)
      .eq('type', 'open_game')
      .maybeSingle()
    if (!existing) {
      await supabase.from('posts').insert({ author_id: user.id, type: 'open_game', game_id: id })
    }
  }
  if (closing) {
    await supabase.from('posts').delete().eq('game_id', id).eq('type', 'open_game').eq('author_id', user.id)
  }

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

  // Verify ownership and fetch game details for notification snapshot
  const { data: game } = await supabase
    .from('games')
    .select('id, scheduled_at, format, neighborhood, creator_id')
    .eq('id', id)
    .eq('creator_id', user.id)
    .single()

  if (!game) return NextResponse.json({ error: 'Not found or not creator' }, { status: 404 })

  // Notify all other participants before deletion.
  // We insert a game_invite message now; ON DELETE SET NULL will flip game_id → null,
  // which the card renders as "This game has been cancelled".
  const { data: participants } = await supabase
    .from('game_participants')
    .select('player_id')
    .eq('game_id', id)
    .neq('player_id', user.id)

  const snapshot = JSON.stringify({
    scheduled_at: game.scheduled_at,
    format: game.format,
    location: game.neighborhood ?? null,
  })

  for (const p of participants ?? []) {
    const { data: convId } = await supabase
      .rpc('shared_conversation_id', { other_user_id: p.player_id })
    if (!convId) continue

    await supabase.from('messages').insert({
      conversation_id: convId,
      sender_id: user.id,
      body: snapshot,
      type: 'game_invite',
      game_id: id,
    })
  }

  // Delete the game — ON DELETE SET NULL propagates to messages.game_id
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', id)
    .eq('creator_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ ok: true })
}
