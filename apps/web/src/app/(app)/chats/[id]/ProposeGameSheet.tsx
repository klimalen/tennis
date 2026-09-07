'use client'

import { useState } from 'react'
import { X, Calendar } from 'lucide-react'

type Format = 'singles' | 'doubles' | 'mixed_doubles'

const FORMAT_OPTIONS: { value: Format; label: string }[] = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'mixed_doubles', label: 'Mixed' },
]

function today() { return new Date().toISOString().slice(0, 10) }
function nowTime() {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  return d.toTimeString().slice(0, 5)
}

interface Props {
  otherUserId: string
  onSent: () => void
}

export function ProposeGameSheet({ otherUserId, onSent }: Props) {
  const [open, setOpen] = useState(false)
  const [date, setDate] = useState(today())
  const [time, setTime] = useState(nowTime())
  const [format, setFormat] = useState<Format>('singles')
  const [location, setLocation] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  function reset() {
    setDate(today())
    setTime(nowTime())
    setFormat('singles')
    setLocation('')
    setError(null)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setSubmitting(true)
    setError(null)

    const scheduled_at = new Date(`${date}T${time}`).toISOString()

    // 1. Create game
    const gameRes = await fetch('/api/games', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        scheduled_at,
        format,
        location_name: location.trim() || undefined,
      }),
    })

    if (!gameRes.ok) {
      setError('Failed to create game')
      setSubmitting(false)
      return
    }

    const { id: gameId } = await gameRes.json() as { id: string }

    // 2. Invite the other person (sends game_invite message in this chat)
    await fetch(`/api/games/${gameId}/invite`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ user_ids: [otherUserId] }),
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

      {/* Backdrop */}
      {open && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm" onClick={() => setOpen(false)} />
      )}

      {/* Sheet */}
      <div className={`fixed bottom-0 left-0 right-0 z-50 bg-brand-bg border-t border-brand-divider transition-transform duration-300 ease-out max-h-[90vh] flex flex-col ${open ? 'translate-y-0' : 'translate-y-full'}`}>
        <div className="max-w-lg mx-auto w-full px-4 pt-4 pb-6 overflow-y-auto flex-1">
          <div className="flex items-center justify-between mb-5">
            <span className="font-display text-2xl tracking-wide">PROPOSE GAME</span>
            <button onClick={() => setOpen(false)} className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.4)]">
              <X size={18} />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
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

            <div>
              <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">
                Where <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]">(optional)</span>
              </label>
              <input type="text" value={location} onChange={(e) => setLocation(e.target.value)}
                placeholder="Court name or address" maxLength={200}
                className="w-full px-3 py-2.5 border border-brand-divider bg-brand-bg text-sm placeholder:text-[rgba(26,26,26,0.25)] focus:outline-none focus:border-brand-primary transition-colors" />
            </div>

            {error && <p className="text-sm text-red-500">{error}</p>}

            <button type="submit" disabled={submitting}
              className="w-full py-3 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
              {submitting ? 'Sending...' : 'Send proposal'}
            </button>
          </form>
        </div>
      </div>
    </>
  )
}
