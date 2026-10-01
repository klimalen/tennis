import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { parseDurationMinutes } from '@/lib/game-time'
import { parseCourtOffer } from '@/lib/game-court'
import { postGameNotice } from '@/lib/game-notice'
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
    venue_group_id?: string | null
    court_cost_cents?: number | null
    payment?: string | null
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
  if (current.creator_id !== user.id) return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

  const canChangeVisibility = typeof body.is_open === 'boolean'
  const opening = canChangeVisibility && body.is_open === true && current.is_open === false
  const closing = canChangeVisibility && body.is_open === false && current.is_open === true

  const patch: {
    scheduled_at?: string
    duration_minutes?: number
    format?: string
    neighborhood?: string | null
    venue_group_id?: string | null
    court_cost_cents?: number | null
    payment?: string | null
    notes?: string | null
    is_open?: boolean
  } = {}
  if (body.scheduled_at) patch.scheduled_at = body.scheduled_at
  if (duration_minutes) patch.duration_minutes = duration_minutes
  if (body.format) patch.format = body.format
  if ('notes' in body) patch.notes = body.notes ?? null
  if (typeof body.is_open === 'boolean') patch.is_open = body.is_open

  if ('venue_group_id' in body || 'location_name' in body || 'court_cost_cents' in body || 'payment' in body) {
    const venueGroupId = body.venue_group_id || null
    let venueName: string | null = null
    let venueFee: boolean | null = null
    if (venueGroupId) {
      const { data: venue } = await supabase
        .from('venue_groups')
        .select('id, name, fee')
        .eq('id', venueGroupId)
        .maybeSingle()
      if (!venue) return NextResponse.json({ error: 'Court not found' }, { status: 400 })
      venueName = venue.name
      venueFee = venue.fee
    }
    const offer = parseCourtOffer(body.court_cost_cents, body.payment, venueFee)
    if (offer.error) return NextResponse.json({ error: offer.error }, { status: 400 })
    patch.venue_group_id = venueGroupId
    patch.neighborhood = venueName ?? (body.location_name?.trim() || null)
    patch.court_cost_cents = offer.court_cost_cents
    patch.payment = offer.payment
  }

  if (Object.keys(patch).length > 0) {
    const { error } = await supabase.from('games').update(patch).eq('id', id).eq('creator_id', user.id)
    if (error) return apiError(500, 'Could not save the game', error)
  }

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
    const newNeighborhood = patch.neighborhood !== undefined ? patch.neighborhood : current.neighborhood

    const snapshot = JSON.stringify({
      scheduled_at: newScheduledAt,
      format: newFormat,
      location: newNeighborhood ?? null,
      updated: true,
    })

    await postGameNotice(supabase, user.id, id, snapshot)
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

  // Notify before deletion. ON DELETE SET NULL flips game_id → null,
  // which the card renders as "This game has been cancelled".
  const snapshot = JSON.stringify({
    scheduled_at: game.scheduled_at,
    format: game.format,
    location: game.neighborhood ?? null,
  })
  await postGameNotice(supabase, user.id, id, snapshot)

  // Delete the game — ON DELETE SET NULL propagates to messages.game_id
  const { error } = await supabase
    .from('games')
    .delete()
    .eq('id', id)
    .eq('creator_id', user.id)

  if (error) return apiError(500, 'Could not delete the game', error)
  return NextResponse.json({ ok: true })
}
