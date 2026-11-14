'use client'

import { useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'
import { FormatFields } from '@/components/games/FormatFields'
import { FormSectionLabel, gameFormOptionPill, WhenFields } from '@/components/games/WhenFields'
import { CourtPlaceFields, type CourtPick, type CourtPlaceValue } from '@/components/games/CourtPlaceFields'
import { InviteConnectionsList, type InviteConnection } from '@/components/games/InviteConnectionsList'
import type { CourtPayment } from '@/lib/game-court'
import { clockFromDuration, durationFromClock, plusMinutes } from '@/lib/game-time'
import { GROUP_SEAT_DEFAULT, type GameFormatChoice } from '@/lib/game-seats'

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Going',
  invited: 'Invited',
  declined: 'Declined',
}

interface Game {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  format: string
  max_players: number
  neighborhood: string | null
  notes: string | null
  is_open: boolean
  venue_group_id: string | null
  court_cost_cents: number | null
  cost_currency: string | null
  payment: string | null
  court: CourtPick | null
}

interface Participant {
  player_id: string
  status: string
  profiles: { full_name: string; username: string; avatar_url: string | null }
}

function toDateInput(iso: string) {
  const dt = new Date(iso)
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

function toTimeInput(iso: string) {
  const dt = new Date(iso)
  return `${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`
}

export function EditGameForm({
  game,
  isCreator,
  participants,
}: {
  game: Game
  isCreator: boolean
  participants: Participant[]
}) {
  const router = useRouter()

  const initialStart = toTimeInput(game.scheduled_at)
  const [date, setDate] = useState(toDateInput(game.scheduled_at))
  const [time, setTime] = useState(initialStart)
  const [endTime, setEndTime] = useState(clockFromDuration(game.scheduled_at, game.duration_minutes ?? 90))
  const [format, setFormat] = useState<GameFormatChoice>(
    game.format === 'doubles' || game.format === 'group' ? game.format : 'singles',
  )
  const [maxPlayers, setMaxPlayers] = useState(game.format === 'group' ? game.max_players : GROUP_SEAT_DEFAULT)
  const [place, setPlace] = useState<CourtPlaceValue>({
    venueId: game.venue_group_id,
    venue: game.court,
    locationName: game.court ? '' : (game.neighborhood ?? ''),
    courtCostCents: game.court_cost_cents,
    costCurrency: (game.cost_currency === 'EUR' || game.cost_currency === 'USD')
      ? game.cost_currency
      : ((game.court_cost_cents ?? 0) > 0 ? 'USD' : null),
    payment: (game.payment as CourtPayment | null) ?? null,
  })
  const [notes, setNotes] = useState(game.notes ?? '')
  const [isOpen, setIsOpen] = useState(game.is_open)
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connections, setConnections] = useState<InviteConnection[]>([])
  const [inviteIds, setInviteIds] = useState<Set<string>>(new Set())

  const participantIds = useMemo(
    () => new Set(participants.map((person) => person.player_id)),
    [participants],
  )
  const inviteable = useMemo(
    () => connections.filter((person) => !participantIds.has(person.id)),
    [connections, participantIds],
  )

  useEffect(() => {
    if (!isCreator) return
    fetch('/api/connections')
      .then((response) => response.json() as Promise<{ connections: InviteConnection[] }>)
      .then((data) => setConnections(data.connections ?? []))
      .catch(() => setConnections([]))
  }, [isCreator])

  function toggleInvite(id: string) {
    setInviteIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const scheduled_at = new Date(`${date}T${time}`).toISOString()
    const duration_minutes = durationFromClock(date, time, endTime)

    const res = await fetch(`/api/games/${game.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at,
        duration_minutes,
        format,
        ...(format === 'group' ? { max_players: maxPlayers } : {}),
        location_name: place.locationName.trim() || null,
        venue_group_id: place.venueId,
        court_cost_cents: place.courtCostCents,
        cost_currency: place.costCurrency,
        payment: place.payment,
        notes: notes.trim() || null,
        ...(isCreator ? { is_open: isOpen } : {}),
      }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
    }

    if (isCreator && inviteIds.size > 0) {
      await fetch(`/api/games/${game.id}/invite`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ user_ids: [...inviteIds] }),
      })
    }

    router.push('/me')
    router.refresh()
  }

  async function handleDelete() {
    setDeleting(true)
    const res = await fetch(`/api/games/${game.id}`, { method: 'DELETE' })
    if (!res.ok) {
      setDeleting(false)
      setShowDeleteConfirm(false)
      return
    }
    router.push('/me')
    router.refresh()
  }

  async function handleLeave() {
    setLeaving(true)
    const res = await fetch(`/api/games/${game.id}/leave`, { method: 'POST' })
    if (!res.ok) {
      setLeaving(false)
      setShowLeaveConfirm(false)
      return
    }
    router.push('/me')
    router.refresh()
  }

  return (
    <div className="min-h-screen pb-8">
      {/* Header */}
      <div className="page-header">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/me" className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
            </Link>
            <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">EDIT GAME</span>
          </div>
          {isCreator && (
            <button onClick={() => setShowDeleteConfirm(true)}
              className="w-9 h-9 flex items-center justify-center text-[rgba(26,26,26,0.35)] hover:text-red-500 transition-colors">
              <Trash2 size={16} />
            </button>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6">
        <form onSubmit={handleSubmit} className="space-y-6">

          <WhenFields
            date={date}
            start={time}
            end={endTime}
            onDate={setDate}
            onStart={(value) => {
              setTime(value)
              setEndTime(plusMinutes(value, 60))
            }}
            onEnd={setEndTime}
          />

          <FormatFields format={format} maxPlayers={maxPlayers} onFormat={setFormat} onMaxPlayers={setMaxPlayers} />

          <CourtPlaceFields value={place} onChange={setPlace} />

          <div>
            <FormSectionLabel>
              About <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]">(optional)</span>
            </FormSectionLabel>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Any information — for example the training format" rows={3} maxLength={500}
              className="font-copy w-full px-3 py-2.5 border border-[#1a1a1a]/40 bg-brand-field rounded-lg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors resize-none" />
          </div>

          {isCreator && (
            <div>
              <FormSectionLabel>Visibility</FormSectionLabel>
              <div className="flex gap-2">
                <button type="button" onClick={() => setIsOpen(false)}
                  className={`${gameFormOptionPill} ${
                    !isOpen ? 'border-[#E8748A] bg-[#E8748A]' : 'hover:border-[#1a1a1a]/60'
                  }`}>
                  Private
                </button>
                <button type="button" onClick={() => setIsOpen(true)}
                  className={`${gameFormOptionPill} ${
                    isOpen ? 'border-[#E8748A] bg-[#E8748A]' : 'hover:border-[#1a1a1a]/60'
                  }`}>
                  Public
                </button>
              </div>
              {isOpen ? (
                <p className="mt-2 text-[11px] text-[rgba(26,26,26,0.4)]">
                  Anyone in your city can find and join this game
                </p>
              ) : (
                <p className="mt-2 text-[11px] text-[rgba(26,26,26,0.55)]">
                  Shows on your profile schedule for anyone who visits. It won&apos;t appear in Open Games, and people can&apos;t join unless you invite them.
                </p>
              )}
            </div>
          )}

          {(participants.length > 0 || (isCreator && inviteable.length > 0)) && (
            <div className="space-y-4">
              {participants.length > 0 && (
                <div>
                  <FormSectionLabel>Players</FormSectionLabel>
                  <div className={`space-y-2 ${participants.length > 8 ? 'max-h-64 overflow-y-auto pr-0.5' : ''}`}>
                    {participants.map((p) => {
                      const initials = p.profiles.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                      const statusLabel = STATUS_LABELS[p.status] ?? p.status
                      const isGoing = p.status === 'accepted'
                      return (
                        <div key={p.player_id} className="flex items-center gap-3 px-3 py-2.5 rounded-[20px] bg-brand-field border border-[#1a1a1a]/15">
                          <Link href={`/profile/${p.profiles.username}`} className="flex items-center gap-3 flex-1 min-w-0 hover:opacity-80 transition-opacity">
                            <div className="w-9 h-9 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center flex-shrink-0">
                              {p.profiles.avatar_url ? (
                                <Image src={p.profiles.avatar_url} alt={p.profiles.full_name} width={36} height={36} className="w-full h-full object-cover" />
                              ) : (
                                <span className="font-display text-sm text-[#1a1a1a]">{initials}</span>
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="text-sm font-medium text-[#1a1a1a] truncate">{p.profiles.full_name}</p>
                              <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{p.profiles.username}</p>
                            </div>
                          </Link>
                          <span className={`text-[9px] tracking-[0.12em] uppercase font-medium ${isGoing ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.35)]'}`}>
                            {statusLabel}
                          </span>
                        </div>
                      )
                    })}
                  </div>
                </div>
              )}

              {isCreator && inviteable.length > 0 && (
                <InviteConnectionsList
                  connections={inviteable}
                  selectedIds={inviteIds}
                  onToggle={toggleInvite}
                  title="Invite more"
                />
              )}
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save changes'}
          </button>

          {!isCreator && (
            <button type="button" onClick={() => setShowLeaveConfirm(true)}
              className="w-full py-3 rounded-full border border-red-200 text-red-500 text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-red-50 transition-colors">
              Leave game
            </button>
          )}
        </form>
      </div>

      {/* Leave confirmation — participants only */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6">
            <span className="font-display text-2xl tracking-wide block mb-3">LEAVE GAME?</span>
            <p className="text-sm text-[rgba(26,26,26,0.5)] mb-5">
              You will be removed from this game. If no players remain, the game will be cancelled automatically.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} disabled={leaving}
                className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-sm font-medium text-[#1a1a1a] hover:bg-white transition-colors">
                Cancel
              </button>
              <button onClick={handleLeave} disabled={leaving}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {leaving ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — creator only */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-white rounded-[28px] max-w-sm w-full p-6">
            <span className="font-display text-2xl tracking-wide block mb-3">CANCEL GAME?</span>
            <p className="text-sm text-[rgba(26,26,26,0.5)] mb-5">
              {participants.some((p) => p.status === 'accepted' || p.status === 'invited')
                ? 'Players who joined or were invited will be notified in chat that this game is fully cancelled.'
                : 'This game will be permanently removed from your schedule.'}
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-sm font-medium text-[#1a1a1a] hover:bg-white transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 rounded-full bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
