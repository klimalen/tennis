'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ArrowLeft, Trash2 } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

type Format = 'singles' | 'doubles' | 'mixed_doubles'

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'mixed_doubles', label: 'Mixed' },
]

const STATUS_LABELS: Record<string, string> = {
  accepted: 'Going',
  invited: 'Invited',
  declined: 'Declined',
}

interface Game {
  id: string
  scheduled_at: string
  format: string
  neighborhood: string | null
  notes: string | null
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
  return new Date(iso).toTimeString().slice(0, 5)
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

  const [date, setDate] = useState(toDateInput(game.scheduled_at))
  const [time, setTime] = useState(toTimeInput(game.scheduled_at))
  const [format, setFormat] = useState<Format>(game.format as Format)
  const [location, setLocation] = useState(game.neighborhood ?? '')
  const [notes, setNotes] = useState(game.notes ?? '')
  const [submitting, setSubmitting] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [leaving, setLeaving] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)
  const [showLeaveConfirm, setShowLeaveConfirm] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const scheduled_at = new Date(`${date}T${time}`).toISOString()

    const res = await fetch(`/api/games/${game.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at,
        format,
        location_name: location.trim() || null,
        notes: notes.trim() || null,
      }),
    })

    if (!res.ok) {
      const data = await res.json() as { error?: string }
      setError(data.error ?? 'Something went wrong')
      setSubmitting(false)
      return
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
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider px-4 py-4 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/me" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
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

          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">When</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Date</label>
                <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] focus:outline-none focus:border-brand-primary transition-colors" />
              </div>
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] focus:outline-none focus:border-brand-primary transition-colors" />
              </div>
            </div>
          </div>

          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">Format</p>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setFormat(opt.value)}
                  className={`flex-1 py-2.5 text-[10px] tracking-[0.15em] uppercase font-medium border transition-colors ${
                    format === opt.value ? 'border-brand-primary text-brand-primary bg-brand-surface' : 'border-brand-divider text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.3)]'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">
              Where <span className="text-[rgba(26,26,26,0.25)] normal-case tracking-normal">(optional)</span>
            </p>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Court name or address" maxLength={200}
              className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors" />
          </div>

          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">
              About <span className="text-[rgba(26,26,26,0.25)] normal-case tracking-normal">(optional)</span>
            </p>
            <textarea value={notes} onChange={(e) => setNotes(e.target.value)}
              placeholder="Practice, match, group training..." rows={3} maxLength={500}
              className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors resize-none" />
          </div>

          {/* Participants */}
          {participants.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">Players</p>
              <div className="space-y-2">
                {participants.map((p) => {
                  const initials = p.profiles.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                  const statusLabel = STATUS_LABELS[p.status] ?? p.status
                  const isGoing = p.status === 'accepted'
                  return (
                    <div key={p.player_id} className="flex items-center gap-3 px-3 py-2.5 border border-brand-divider">
                      <div className="w-9 h-9 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                        {p.profiles.avatar_url ? (
                          <Image src={p.profiles.avatar_url} alt={p.profiles.full_name} width={36} height={36} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-sm text-[rgba(26,26,26,0.3)]">{initials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{p.profiles.full_name}</p>
                        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{p.profiles.username}</p>
                      </div>
                      <span className={`text-[9px] tracking-[0.12em] uppercase font-medium ${isGoing ? 'text-brand-primary' : 'text-[rgba(26,26,26,0.35)]'}`}>
                        {statusLabel}
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting}
            className="w-full py-4 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
            {submitting ? 'Saving...' : 'Save changes'}
          </button>

          {!isCreator && (
            <button type="button" onClick={() => setShowLeaveConfirm(true)}
              className="w-full py-3 border border-red-200 text-red-500 text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-red-50 transition-colors">
              Leave game
            </button>
          )}
        </form>
      </div>

      {/* Leave confirmation — participants only */}
      {showLeaveConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-brand-bg border border-brand-divider shadow-xl max-w-sm w-full p-6">
            <span className="font-display text-2xl tracking-wide block mb-3">LEAVE GAME?</span>
            <p className="text-sm text-[rgba(26,26,26,0.5)] mb-5">
              You will be removed from this game. If no players remain, the game will be cancelled automatically.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowLeaveConfirm(false)} disabled={leaving}
                className="flex-1 py-2.5 border border-brand-divider text-sm font-medium text-[rgba(26,26,26,0.6)] hover:bg-brand-surface transition-colors">
                Cancel
              </button>
              <button onClick={handleLeave} disabled={leaving}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {leaving ? 'Leaving...' : 'Leave'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete confirmation — creator only */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center px-4 bg-black/40 backdrop-blur-sm">
          <div className="bg-brand-bg border border-brand-divider shadow-xl max-w-sm w-full p-6">
            <span className="font-display text-2xl tracking-wide block mb-3">DELETE GAME?</span>
            <p className="text-sm text-[rgba(26,26,26,0.5)] mb-5">
              This game will be permanently removed from your schedule.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setShowDeleteConfirm(false)} disabled={deleting}
                className="flex-1 py-2.5 border border-brand-divider text-sm font-medium text-[rgba(26,26,26,0.6)] hover:bg-brand-surface transition-colors">
                Cancel
              </button>
              <button onClick={handleDelete} disabled={deleting}
                className="flex-1 py-2.5 bg-red-500 text-white text-sm font-medium hover:bg-red-600 disabled:opacity-50 transition-colors">
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
