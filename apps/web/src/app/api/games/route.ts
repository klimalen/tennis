import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { parseDurationMinutes } from '@/lib/game-time'
import { parseCourtOffer } from '@/lib/game-court'
import { NextResponse } from 'next/server'

export async function POST(request: Request) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as {
    scheduled_at: string
    duration_minutes?: number
    format: string
    location_name?: string
    venue_group_id?: string | null
    court_cost_cents?: number | null
    payment?: string | null
    notes?: string
    is_open?: boolean
  }

  const { scheduled_at, format, location_name, notes, is_open } = body
  const duration_minutes = parseDurationMinutes(body.duration_minutes)
  const venueGroupId = body.venue_group_id || null

  if (!scheduled_at || !format) {
    return NextResponse.json({ error: 'scheduled_at and format are required' }, { status: 400 })
  }

  const { data: creator } = await supabase
    .from('profiles')
    .select('account_kind')
    .eq('id', user.id)
    .maybeSingle()
  const isCourt = creator?.account_kind === 'court'

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

  const gameId = crypto.randomUUID()
  const max_players = format === 'singles' ? 2 : 4
  const placeName = venueName ?? (location_name?.trim() || null)

  const { error: gameErr } = await supabase
    .from('games')
    .insert({
      id: gameId,
      creator_id: user.id,
      format,
      scheduled_at,
      ...(duration_minutes ? { duration_minutes } : {}),
      neighborhood: placeName,
      venue_group_id: venueGroupId,
      court_cost_cents: offer.court_cost_cents,
      payment: offer.payment,
      notes: notes ?? null,
      is_open: isCourt ? true : (is_open ?? false),
      ...(isCourt ? { skill_level_min: null, skill_level_max: null } : {}),
      max_players,
      status: 'confirmed',
    })

  if (gameErr) {
    return apiError(500, 'Could not create the game', gameErr)
  }

  if (!isCourt) {
    const { error: participantErr } = await supabase
      .from('game_participants')
      .insert({ game_id: gameId, player_id: user.id, status: 'accepted' })

    if (participantErr) {
      console.error('[POST /api/games] participant insert error:', participantErr)
    }
  }

  return NextResponse.json({ id: gameId }, { status: 201 })
}
