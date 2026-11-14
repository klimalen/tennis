'use client'

import { useState } from 'react'
import { Bell, BellOff, Loader2 } from 'lucide-react'

export function ChatMuteButton({
  conversationId,
  initiallyMuted,
  className,
}: {
  conversationId: string
  initiallyMuted: boolean
  className?: string
}) {
  const [muted, setMuted] = useState(initiallyMuted)
  const [busy, setBusy] = useState(false)

  async function toggle() {
    if (busy) return
    const next = !muted
    setBusy(true)
    setMuted(next)
    const res = await fetch(`/api/conversations/${conversationId}/mute`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ muted: next }),
    })
    if (!res.ok) setMuted(!next)
    setBusy(false)
  }

  return (
    <button
      type="button"
      onClick={() => void toggle()}
      disabled={busy}
      aria-label={muted ? 'Unmute chat notifications' : 'Mute chat notifications'}
      className={`flex size-9 shrink-0 items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white text-[rgba(26,26,26,0.6)] transition-colors hover:bg-brand-field disabled:opacity-50 ${className ?? ''}`}
    >
      {busy ? (
        <Loader2 size={16} className="animate-spin" />
      ) : muted ? (
        <BellOff size={16} />
      ) : (
        <Bell size={16} />
      )}
    </button>
  )
}
