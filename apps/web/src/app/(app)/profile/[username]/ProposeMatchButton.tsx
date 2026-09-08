'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ButtonState = 'idle' | 'loading' | 'sent' | 'connected'

function statusToState(status: string | null): ButtonState {
  if (status === 'pending') return 'sent'
  if (status === 'accepted' || status === 'matched') return 'connected'
  return 'idle'
}

export function ProposeMatchButton({
  receiverId,
  receiverName,
  existingStatus,
}: {
  receiverId: string
  receiverName: string
  existingStatus: string | null
}) {
  const router = useRouter()
  const [state, setState] = useState<ButtonState>(statusToState(existingStatus))

  async function handleClick() {
    // Connected → open game creation form with this player pre-filled
    if (state === 'connected') {
      router.push(`/games/new?invite=${receiverId}&name=${encodeURIComponent(receiverName)}`)
      return
    }
    if (state !== 'idle') return
    setState('loading')

    const res = await fetch('/api/game-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId }),
    })

    if (!res.ok) { setState('idle'); return }

    const data = await res.json() as { matched: boolean }
    // Mutual match → auto-follow happened, show as connected
    setState(data.matched ? 'connected' : 'sent')
  }

  const labels: Record<ButtonState, string> = {
    idle:      'Suggest a match',
    loading:   'Sending...',
    sent:      'Request sent',
    connected: 'Suggest a match',
  }

  return (
    <button
      onClick={handleClick}
      disabled={state === 'loading' || state === 'sent'}
      className="w-full py-3 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-60 disabled:cursor-default"
    >
      {labels[state]}
    </button>
  )
}
