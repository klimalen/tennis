import { createClient } from '@/lib/supabase/server'
import { apiError } from '@/lib/api-error'
import { siteOrigin } from '@/lib/site-origin'
import { buildCalendarEvent, buildIcs, type CalendarPerson } from '@/lib/calendar-event'
import { NextResponse } from 'next/server'

function one<T>(value: T | T[] | null | undefined): T | null {
  if (Array.isArray(value)) return value[0] ?? null
  return value ?? null
}

function num(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim()) {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return null
}

type ProfileBits = { full_name: string | null; account_kind: string | null }
type ParticipantBits = { player_id: string; status: string; profile: ProfileBits | ProfileBits[] | null }
type CourtBits = {
  name: string | null
  address: string | null
  city_name: string | null
  lat: number | string | null
  lng: number | string | null
  fee: boolean | null
}

/**
 * Apple Calendar (and any other app) opens this file.
 * Google and Outlook use prefilled links built in the browser from the same event.
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { id } = await params
  const { data, error } = await supabase
    .from('games')
    .select(`
      id, format, scheduled_at, duration_minutes, neighborhood, notes,
      court_cost_cents, cost_currency, payment, status, creator_id,
      court:venue_groups!games_venue_group_id_fkey (name, address, city_name, lat, lng, fee),
      creator:profiles!creator_id (id, full_name, account_kind),
      city:cities (name),
      participants:game_participants (
        player_id, status,
        profile:profiles!player_id (full_name, account_kind)
      )
    `)
    .eq('id', id)
    .maybeSingle()

  if (error) return apiError(500, 'Could not load the game', error)
  if (!data) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  const row = data as {
    id: string
    format: string
    scheduled_at: string
    duration_minutes: number | null
    neighborhood: string | null
    notes: string | null
    court_cost_cents: number | null
    cost_currency: string | null
    payment: string | null
    status: string
    creator_id: string
    court: CourtBits | CourtBits[] | null
    creator: (ProfileBits & { id: string }) | (ProfileBits & { id: string })[] | null
    city: { name: string | null } | { name: string | null }[] | null
    participants: ParticipantBits[] | null
  }

  const participants = row.participants ?? []
  const inGame =
    row.creator_id === user.id ||
    participants.some((participant) => participant.player_id === user.id && participant.status === 'accepted')
  if (!inGame || row.status === 'cancelled' || row.status === 'draft') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const court = one(row.court)
  const creator = one(row.creator)
  const city = one(row.city)
  const organiser: CalendarPerson | null = creator
    ? { id: creator.id, name: creator.full_name, accountKind: creator.account_kind }
    : null
  const origin = await siteOrigin()
  const event = buildCalendarEvent({
    id: row.id,
    format: row.format,
    scheduledAt: row.scheduled_at,
    durationMinutes: row.duration_minutes,
    notes: row.notes,
    neighborhood: row.neighborhood,
    courtName: court?.name ?? null,
    courtAddress: court?.address ?? null,
    courtCity: court?.city_name?.trim() || city?.name || null,
    lat: num(court?.lat),
    lng: num(court?.lng),
    fee: court?.fee ?? null,
    courtCostCents: row.court_cost_cents,
    costCurrency: row.cost_currency,
    payment: row.payment,
    organiser,
    players: participants.map((participant) => {
      const profile = one(participant.profile)
      return {
        id: participant.player_id,
        name: profile?.full_name ?? null,
        accountKind: profile?.account_kind ?? null,
        status: participant.status,
      }
    }),
    viewerId: user.id,
    pageUrl: `${origin}/game/${row.id}`,
  })
  if (!event) return NextResponse.json({ error: 'Not found' }, { status: 404 })

  return new NextResponse(buildIcs(event, row.id), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="tennis-game.ics"',
      'Cache-Control': 'private, no-store',
    },
  })
}
