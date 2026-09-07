'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function PlayTogetherButton({ receiverId }: { receiverId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading' | 'sent' | 'matched'>('idle')

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

  const labels = {
    idle:    'Play together',
    loading: 'Sending…',
    sent:    'Request sent',
    matched: 'Matched!',
  }

  return (
    <button
      onClick={handleClick}
      disabled={state !== 'idle'}
      className="w-full mt-4 py-3 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-60 disabled:cursor-default"
    >
      {labels[state]}
    </button>
  )
}
