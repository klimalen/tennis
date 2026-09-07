'use client'

import { useState, useEffect } from 'react'
import { X, Calendar } from 'lucide-react'
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

function today() { return new Date().toISOString().slice(0, 10) }
function nowTime() {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  return d.toTimeString().slice(0, 5)
}

interface Props {
  otherUserId: string
  otherName: string
  onSent: () => void
}

export function ProposeGameSheet({ otherUserId, otherName, onSent }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today())
  const [time, setTime] = useState(nowTime())
  const [format, setFormat] = useState<Format>('singles')
  const [location, setLocation] = useState('')
  const [about, setAbout] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Extra participants (beyond the chat partner who is pre-selected)
  const [connections, setConnections] = useState<Connection[]>([])
  const [extraIds, setExtraIds] = useState<Set<string>>(new Set())

  useEffect(() => {
    if (!open) return
    fetch('/api/connections')
      .then((r) => r.json() as Promise<{ connections: Connection[] }>)
      .then((data) => {
        // Exclude the chat partner from the "add more" list since they're pre-selected
        setConnections((data.connections ?? []).filter((c) => c.id !== otherUserId))
      })
      .catch(() => {})
  }, [open, otherUserId])

  function toggle(id: string) {
    setExtraIds((prev) => {
      const next = new Set(prev)
      next.has(id) ? next.delete(id) : next.add(id)
      return next
    })
  }

  function reset() {
    setDate(today())
    setTime(nowTime())
    setFormat('singles')
    setLocation('')
    setAbout('')
    setExtraIds(new Set())
    setError(null)
  }

  async function handleSubmit() {
    if (!date || !time || submitting) return
    setSubmitting(true)
    setError(null)

    const scheduled_at = new Date(`${date}T${time}`).toISOString()

    const gameRes = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at, format,
        location_name: location.trim() || undefined,
        notes: about.trim() || undefined,
      }),
    })

    if (!gameRes.ok) {
      setError('Failed to create game')
      setSubmitting(false)
      return
    }

    const { id: gameId } = await gameRes.json() as { id: string }

    // Always invite chat partner + any extra selected players
    const allInvitees = [otherUserId, ...Array.from(extraIds)]
    await fetch(`/api/games/${gameId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: allInvitees }),
    })

    setSubmitting(false)
    setOpen(false)
    reset()
    onSent()
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-divider text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary transition-colors"
      >
        <Calendar size={12} />
        Propose game
      </button>

      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sheet: flex column so footer stays fixed at bottom of sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-brand-bg border-t border-brand-divider transition-transform duration-300 ease-out max-h-[92vh] flex flex-col ${open ? 'translate-y-0' : 'translate-y-full'}`}>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto">
          <div className="max-w-lg mx-auto w-full px-4 pt-4 pb-2">
            <div className="flex items-center justify-between mb-5">
              <span className="font-display text-2xl tracking-wide">PROPOSE GAME</span>
              <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.4)]">
                <X size={18} />
              </button>
            </div>

            <div className="space-y-4">
              {/* Date + Time */}
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Date</label>
                  <input type="date" value={date} min={today()} onChange={(e) => setDate(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm focus:outline-none focus:border-brand-primary transition-colors" />
                </div>
                <div>
                  <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Time</label>
                  <input type="time" value={time} onChange={(e) => setTime(e.target.value)} required
                    className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm focus:outline-none focus:border-brand-primary transition-colors" />
                </div>
              </div>

              {/* Format */}
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Format</label>
                <div className="flex gap-2">
                  {FORMAT_OPTIONS.map((opt) => (
                    <button key={opt.value} type="button" onClick={() => setFormat(opt.value)}
                      className={`flex-1 py-2 text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${format === opt.value ? 'border-brand-primary text-brand-primary bg-brand-surface' : 'border-brand-divider text-[rgba(26,26,26,0.5)]'}`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* Where */}
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">
                  Where <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]">(optional)</span>
                </label>
                <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                  placeholder="Court name or address" maxLength={200}
                  className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors" />
              </div>

              {/* About */}
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">
                  About <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]">(optional)</span>
                </label>
                <textarea value={about} onChange={(e) => setAbout(e.target.value)}
                  placeholder="Practice, match, group training..." rows={2} maxLength={500}
                  className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors resize-none" />
              </div>

              {/* Participants */}
              <div>
                <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-2">Players</label>

                {/* Pre-selected chat partner */}
                <div className="flex items-center gap-2 px-3 py-2 border border-brand-primary bg-brand-surface mb-2">
                  <div className="w-2 h-2 rounded-full bg-brand-primary flex-shrink-0" />
                  <span className="text-sm text-[#1a1a1a] flex-1">{otherName}</span>
                  <span className="text-[9px] tracking-[0.1em] uppercase text-brand-primary">Invited</span>
                </div>

                {/* Extra connections */}
                {connections.length > 0 && (
                  <div className="space-y-1.5 mt-1.5">
                    <p className="text-[9px] tracking-[0.12em] uppercase text-[rgba(26,26,26,0.3)]">Add more</p>
                    {connections.map((c) => {
                      const selected = extraIds.has(c.id)
                      const initials = c.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
                      return (
                        <button key={c.id} type="button" onClick={() => toggle(c.id)}
                          className={`w-full flex items-center gap-3 px-3 py-2.5 border transition-colors text-left ${selected ? 'border-brand-primary bg-brand-surface' : 'border-brand-divider'}`}>
                          <div className="w-8 h-8 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                            {c.avatar_url
                              ? <Image src={c.avatar_url} alt={c.full_name} width={32} height={32} className="w-full h-full object-cover" />
                              : <span className="font-display text-xs text-[rgba(26,26,26,0.3)]">{initials}</span>}
                          </div>
                          <span className="flex-1 text-sm text-[#1a1a1a] truncate">{c.full_name}</span>
                          <div className={`w-4 h-4 border flex items-center justify-center flex-shrink-0 ${selected ? 'border-brand-primary bg-brand-primary' : 'border-brand-divider'}`}>
                            {selected && <span className="text-white text-[9px] font-bold">✓</span>}
                          </div>
                        </button>
                      )
                    })}
                  </div>
                )}
              </div>

              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          </div>
        </div>

        {/* Fixed footer inside sheet */}
        <div className="flex-shrink-0 border-t border-brand-divider px-4 py-4">
          <div className="max-w-lg mx-auto">
            <button onClick={handleSubmit} disabled={submitting || !date || !time}
              className="w-full py-3 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
              {submitting ? 'Sending...' : extraIds.size > 0 ? `Send to ${1 + extraIds.size} players` : 'Send proposal'}
            </button>
          </div>
        </div>
      </div>
    </>
  )
}
