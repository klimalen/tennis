'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { ArrowLeft, Globe, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { FormatFields } from '@/components/games/FormatFields'
import { AboutField } from '@/components/games/AboutField'
import { FormNote, FormSectionLabel, gameFormPanel, WhenFields } from '@/components/games/WhenFields'
import { VisibilityFields } from '@/components/games/VisibilityFields'
import type { GameVisibility } from '@/lib/game-visibility'
import { CourtPlaceFields, emptyCourtPlace, type CourtPlaceValue } from '@/components/games/CourtPlaceFields'
import { InviteConnectionsList, InvitedPlayerRow } from '@/components/games/InviteConnectionsList'
import { durationFromClock, nowTimeInput, plusMinutes, todayInput } from '@/lib/game-time'
import { GROUP_SEAT_DEFAULT, type GameFormatChoice } from '@/lib/game-seats'

interface Connection {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

export default function NewGamePage() {
  return (
    <Suspense>
      <NewGameForm />
    </Suspense>
  )
}

function NewGameForm() {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Pre-selected player from chat (e.g. ?invite=ID&name=Name)
  const preselectedId = searchParams.get('invite') ?? ''
  const preselectedName = searchParams.get('name') ?? ''

  const initialStart = nowTimeInput()
  const [date, setDate] = useState(todayInput())
  const [time, setTime] = useState(initialStart)
  const [endTime, setEndTime] = useState(plusMinutes(initialStart, 60))
  const [format, setFormat] = useState<GameFormatChoice>('singles')
  const [maxPlayers, setMaxPlayers] = useState(GROUP_SEAT_DEFAULT)
  const [place, setPlace] = useState<CourtPlaceValue>(emptyCourtPlace())
  const [about, setAbout] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [connectionsLoaded, setConnectionsLoaded] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())
  const [visibility, setVisibility] = useState<GameVisibility>('friends')
  const [preselectedOk, setPreselectedOk] = useState(!preselectedId)
  const [isCourt, setIsCourt] = useState(false)
  const [accountReady, setAccountReady] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!user) { setAccountReady(true); return }
      const { data: profile } = await supabase
        .from('profiles')
        .select('account_kind, full_name, address, city_name')
        .eq('id', user.id)
        .maybeSingle()
      if (profile?.account_kind === 'court') {
        setIsCourt(true)
        const { data: venue } = await supabase
          .from('venue_groups')
          .select('id, name, address, fee, lit, access')
          .eq('profile_id', user.id)
          .limit(1)
          .maybeSingle()
        if (venue) {
          setPlace({
            venueId: venue.id,
            venue: {
              id: venue.id,
              name: venue.name,
              address: venue.address,
              fee: venue.fee,
              lit: venue.lit,
              access: venue.access,
            },
            locationName: '',
            courtCostCents: venue.fee === false ? 0 : null,
            costCurrency: null,
            payment: null,
          })
        } else {
          const label = [profile.full_name?.trim(), profile.address?.trim(), profile.city_name?.trim()]
            .filter(Boolean)
            .join(', ')
          setPlace({
            venueId: null,
            venue: null,
            locationName: label || profile.full_name || 'My court',
            courtCostCents: null,
            costCurrency: null,
            payment: null,
          })
        }
      }
      setAccountReady(true)
    })
  }, [])

  useEffect(() => {
    fetch('/api/follows/mutual')
      .then((r) => r.json() as Promise<{ friends: Connection[] }>)
      .then((data) => {
        const friends = data.friends ?? []
        setPreselectedOk(!preselectedId || friends.some((friend) => friend.id === preselectedId))
        setConnections(friends.filter((friend) => friend.id !== preselectedId))
      })
      .catch(() => {})
      .finally(() => setConnectionsLoaded(true))
  }, [preselectedId])

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!date || !time || !endTime || submitting) return
    setSubmitting(true)
    setError(null)

    const scheduled_at = new Date(`${date}T${time}`).toISOString()
    const duration_minutes = durationFromClock(date, time, endTime)

    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at, duration_minutes, format,
        ...(format === 'group' ? { max_players: maxPlayers } : {}),
        location_name: place.locationName.trim() || undefined,
        venue_group_id: place.venueId,
        court_cost_cents: place.courtCostCents,
        cost_currency: place.costCurrency,
        payment: place.payment,
        notes: about.trim() || undefined,
        visibility: isCourt ? 'open' : visibility,
      }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    const { id: gameId } = await res.json() as { id: string }

    const allInvitees = [
      ...(preselectedId && preselectedOk ? [preselectedId] : []),
      ...Array.from(selectedIds),
    ]
    if (!isCourt && allInvitees.length > 0) {
      await fetch(`/api/games/${gameId}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: allInvitees }),
      })
    }

    router.push('/me')
  }

  const totalInvites = selectedIds.size + (preselectedId ? 1 : 0)
  const submitLabel = submitting
    ? 'Saving...'
    : totalInvites > 0
      ? `Save & invite ${totalInvites} player${totalInvites > 1 ? 's' : ''}`
      : 'Save game'

  return (
    <div className="min-h-screen pb-10">
      <div className="page-header">
        <div className="mx-auto flex max-w-xl items-center gap-3">
          <Link href="/me" aria-label="Back" className="flex h-10 w-10 items-center justify-center rounded-full border border-[#1a1a1a]/10 bg-white transition-colors hover:bg-brand-surface">
            <ArrowLeft size={17} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-[28px] leading-none tracking-wide text-[#1a1a1a]">NEW GAME</span>
        </div>
      </div>

      <div className="mx-auto max-w-xl space-y-6 px-4 py-6">
        <WhenFields
          date={date}
          start={time}
          end={endTime}
          minDate={todayInput()}
          onDate={setDate}
          onStart={(value) => {
            setTime(value)
            setEndTime(plusMinutes(value, 60))
          }}
          onEnd={setEndTime}
        />

        <FormatFields format={format} maxPlayers={maxPlayers} onFormat={setFormat} onMaxPlayers={setMaxPlayers} />

        {!isCourt && <VisibilityFields value={visibility} onChange={setVisibility} />}

        <AboutField value={about} onChange={setAbout} />

        <CourtPlaceFields value={place} onChange={setPlace} locked={isCourt} />

        {isCourt && (
          <FormNote icon={<Globe size={15} strokeWidth={1.7} />}>
            Open game. Players join on their own, and the court doesn&apos;t take a spot.
          </FormNote>
        )}

        {!isCourt && preselectedId && preselectedName && preselectedOk && (
          <section>
            <FormSectionLabel>Players</FormSectionLabel>
            <div className={`${gameFormPanel} p-2`}>
              <InvitedPlayerRow name={preselectedName} />
            </div>
          </section>
        )}
        {!isCourt && connectionsLoaded && preselectedId && !preselectedOk && (
          <FormNote>{preselectedName || 'That player'} has to follow you back before you can invite them</FormNote>
        )}

        {!isCourt && connections.length > 0 && (
          <InviteConnectionsList
            connections={connections}
            selectedIds={selectedIds}
            onToggle={togglePlayer}
            title={preselectedId ? 'Add more players' : 'Invite players'}
          />
        )}

        {!isCourt && connectionsLoaded && connections.length === 0 && !preselectedId && (
          <FormNote icon={<UserPlus size={15} strokeWidth={1.7} />}>
            You can invite players who follow you back
          </FormNote>
        )}

        {error && <p className="text-sm text-red-500">{error}</p>}

        <button onClick={handleSubmit} disabled={submitting || !accountReady || !date || !time || !endTime}
          className="w-full rounded-full bg-[#E8748A] py-[18px] text-[11px] font-semibold uppercase tracking-[0.22em] text-[#1a1a1a] transition-colors hover:bg-[#E8406A] disabled:opacity-50">
          {submitLabel}
        </button>
      </div>
    </div>
  )
}
