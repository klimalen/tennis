import { createClient } from '@/lib/supabase/server'
import { createAdminClient } from '@/lib/supabase/admin'
import { apiError } from '@/lib/api-error'
import { siteOrigin } from '@/lib/site-origin'
import { readCalendarLink, signCalendarLink } from '@/lib/calendar-link'
import { buildCalendarEvent, buildIcs, type CalendarPerson } from '@/lib/calendar-event'
import { NextResponse } from 'next/server'
import type { SupabaseClient } from '@supabase/supabase-js'

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
  lat: number | string | null
  lng: number | string | null
  fee: boolean | null
}

const GAME_SELECT = `
  id, format, scheduled_at, duration_minutes, neighborhood, notes,
  court_cost_cents, cost_currency, payment, status, creator_id,
  court:venue_groups!games_venue_group_id_fkey (name, address, lat, lng, fee),
  creator:profiles!creator_id (id, full_name, account_kind),
  city:cities (name),
  participants:game_participants (
    player_id, status,
    profile:profiles!player_id (full_name, account_kind)
  )
`

/**
 * One event file. The phone opens it outside the signed-in page, so a
 * short-lived signature stands in for the session cookie.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const requestUrl = new URL(request.url)
  const { id } = await params
  const token = requestUrl.searchParams.get('t')
  const mint = requestUrl.searchParams.get('mint') === '1'

  let userId: string | null = null
  let supabase: SupabaseClient
  if (token) {
    const link = readCalendarLink(token)
    if (!link || link.gameId !== id) return fail(request, 401, 'This calendar link expired. Go back to the game and tap Add to calendar again.')
    userId = link.userId
    try {
      supabase = createAdminClient()
    } catch (error) {
      return apiError(500, 'Could not load the game', error)
    }
  } else {
    supabase = await createClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return fail(request, 401, 'Sign in on the game page and tap Add to calendar again.')
    userId = user.id
  }

  const { data, error } = await supabase
    .from('games')
    .select(GAME_SELECT)
    .eq('id', id)
    .maybeSingle()

  if (error) return apiError(500, 'Could not load the game', error)
  if (!data) return fail(request, 404, 'This game is not available.')

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
    row.creator_id === userId ||
    participants.some((participant) => participant.player_id === userId && participant.status === 'accepted')
  if (!inGame || row.status === 'cancelled' || row.status === 'draft') {
    return fail(request, 404, 'This game is not available.')
  }

  if (mint && !token) {
    const signed = signCalendarLink(id, userId)
    if (!signed) return apiError(500, 'Could not prepare the calendar file')
    const origin = await siteOrigin()
    const fileUrl = new URL(`/api/games/${id}/calendar`, origin)
    fileUrl.searchParams.set('t', signed)
    return NextResponse.json(
      { url: fileUrl.toString() },
      { headers: { 'Cache-Control': 'private, no-store' } },
    )
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
    courtCity: city?.name?.trim() || null,
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
    viewerId: userId,
    pageUrl: `${origin}/game/${row.id}`,
  })
  if (!event) return fail(request, 404, 'This game is not available.')

  return new NextResponse(buildIcs(event, row.id), {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'inline; filename="tennis-game.ics"',
      'Cache-Control': 'private, no-store',
      'X-Content-Type-Options': 'nosniff',
    },
  })
}

function fail(request: Request, status: number, message: string) {
  const accept = request.headers.get('accept') ?? ''
  if (accept.includes('application/json')) {
    return NextResponse.json({ error: status === 401 ? 'Unauthorized' : message }, { status })
  }
  return new NextResponse(`${message}\n`, {
    status,
    headers: {
      'Content-Type': 'text/plain; charset=utf-8',
      'Cache-Control': 'private, no-store',
    },
  })
}
