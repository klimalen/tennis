'use client'

import { useState, useEffect, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

type Format = 'singles' | 'doubles' | 'mixed_doubles'

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'mixed_doubles', label: 'Mixed' },
]

interface Connection {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

function today() {
  const dt = new Date()
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
function nowTime() {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  return d.toTimeString().slice(0, 5)
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

  const [date, setDate] = useState(today())
  const [time, setTime] = useState(nowTime())
  const [format, setFormat] = useState<Format>('singles')
  const [location, setLocation] = useState('')
  const [about, setAbout] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [connections, setConnections] = useState<Connection[]>([])
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    fetch('/api/connections')
      .then((r) => r.json() as Promise<{ connections: Connection[] }>)
      .then((data) => {
        // Don't show the pre-selected person in the optional list
        setConnections((data.connections ?? []).filter((c) => c.id !== preselectedId))
      })
      .catch(() => {})
  }, [preselectedId])

  function togglePlayer(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  async function handleSubmit() {
    if (!date || !time || submitting) return
    setSubmitting(true)
    setError(null)

    const scheduled_at = new Date(`${date}T${time}`).toISOString()

    const res = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at, format,
        location_name: location.trim() || undefined,
        notes: about.trim() || undefined,
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
      ...(preselectedId ? [preselectedId] : []),
      ...Array.from(selectedIds),
    ]
    if (allInvitees.length > 0) {
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
    <div className="min-h-screen pb-24 md:pb-8">
      {/* Header with Save button */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider px-4 py-4 z-10">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/me" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
            </Link>
            <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">NEW GAME</span>
          </div>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 py-6 space-y-6">

          {/* When */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">When</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Date</label>
                <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] focus:outline-none focus:border-brand-primary transition-colors" />
              </div>
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Time</label>
                <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required
                  className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] focus:outline-none focus:border-brand-primary transition-colors" />
              </div>
            </div>
          </div>

          {/* Format */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">Format</p>
            <div className="flex gap-2">
              {FORMAT_OPTIONS.map((opt) => (
                <button key={opt.value} type="button" onClick={() => setFormat(opt.value)}
                  className={`flex-1 py-2.5 text-[10px] tracking-[0.15em] uppercase font-medium border transition-colors ${
                    format === opt.value
                      ? 'border-brand-primary text-brand-primary bg-brand-surface'
                      : 'border-brand-divider text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.3)]'
                  }`}>
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Where */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">
              Where <span className="text-[rgba(26,26,26,0.25)] normal-case tracking-normal">(optional)</span>
            </p>
            <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
              placeholder="Court name or address" maxLength={200}
              className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors" />
          </div>

          {/* About */}
          <div>
            <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">
              About <span className="text-[rgba(26,26,26,0.25)] normal-case tracking-normal">(optional)</span>
            </p>
            <textarea value={about} onChange={(e) => setAbout(e.target.value)}
              placeholder="Practice, match, group training..." rows={3} maxLength={500}
              className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors resize-none" />
          </div>

          {/* Pre-selected player from chat */}
          {preselectedId && preselectedName && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">Players</p>
              <div className="flex items-center gap-2 px-3 py-2.5 border border-brand-primary bg-brand-surface">
                <div className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
                <span className="text-sm text-[#1a1a1a] flex-1">{preselectedName}</span>
                <span className="text-[9px] tracking-[0.1em] uppercase text-brand-primary">Invited</span>
              </div>
            </div>
          )}

          {/* Invite more players */}
          {connections.length > 0 && (
            <div>
              <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">
                {preselectedId ? 'Add more players' : 'Invite players'}{' '}
                <span className="text-[rgba(26,26,26,0.25)] normal-case tracking-normal">(optional)</span>
              </p>
              <div className="space-y-2">
                {connections.map((c) => {
                  const selected = selectedIds.has(c.id)
                  const initials = c.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                  return (
                    <button key={c.id} type="button" onClick={() => togglePlayer(c.id)}
                      className={`w-full flex items-center gap-3 px-3 py-3 border transition-colors text-left ${
                        selected ? 'border-brand-primary bg-brand-surface' : 'border-brand-divider hover:border-[rgba(26,26,26,0.3)]'
                      }`}>
                      <div className="w-9 h-9 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                        {c.avatar_url ? (
                          <Image src={c.avatar_url} alt={c.full_name} width={36} height={36} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-sm text-[rgba(26,26,26,0.3)]">{initials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-[#1a1a1a] truncate">{c.full_name}</p>
                        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{c.username}</p>
                      </div>
                      <div className={`w-5 h-5 border flex items-center justify-center flex-shrink-0 transition-colors ${
                        selected ? 'border-brand-primary bg-brand-primary' : 'border-brand-divider'
                      }`}>
                        {selected && <span className="text-white text-[10px] font-bold">✓</span>}
                      </div>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-red-500">{error}</p>}

          <button onClick={handleSubmit} disabled={submitting || !date || !time}
            className="w-full py-4 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
            {submitLabel}
          </button>
        </div>

    </div>
  )
}
