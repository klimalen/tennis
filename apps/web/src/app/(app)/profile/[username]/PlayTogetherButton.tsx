'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

type ButtonState = 'idle' | 'loading' | 'sent' | 'matched'

function statusToState(status: string | null): ButtonState {
  if (status === 'pending') return 'sent'
  if (status === 'accepted' || status === 'matched') return 'matched'
  return 'idle'
}

export function PlayTogetherButton({
  receiverId,
  existingStatus,
}: {
  receiverId: string
  existingStatus: string | null
}) {
  const router = useRouter()
  const [state, setState] = useState<ButtonState>(statusToState(existingStatus))

  async function handleClick() {
    if (state !== 'idle') return
    setState('loading')

    const res = await fetch('/api/game-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId }),
    })

    if (!res.ok) {
      setState('idle')
      return
    }

    const data = await res.json() as { matched: boolean; conversation_id?: string }
    if (data.matched && data.conversation_id) {
      setState('matched')
      router.push('/chats')
    } else {
      setState('sent')
    }
  }

  const labels: Record<ButtonState, string> = {
    idle:    'Play together',
    loading: 'Sending…',
    sent:    'Request sent',
    matched: 'Matched — open chat',
  }

  return (
    <button
      onClick={state === 'matched' ? () => router.push('/chats') : handleClick}
      disabled={state === 'loading' || state === 'sent'}
      className="w-full py-3 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-60 disabled:cursor-default"
    >
      {labels[state]}
    </button>
  )
}
