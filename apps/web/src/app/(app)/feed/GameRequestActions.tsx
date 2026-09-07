'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

export function GameRequestActions({ requestId, senderId }: { requestId: string; senderId: string }) {
  const router = useRouter()
  const [state, setState] = useState<'idle' | 'loading'>('idle')

  async function respond(action: 'accept' | 'decline') {
    if (state === 'loading') return
    setState('loading')

    const res = await fetch(`/api/game-requests/${requestId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action, sender_id: senderId }),
    })

    if (res.ok && action === 'accept') {
      const data = await res.json() as { conversation_id?: string }
      if (data.conversation_id) {
        router.push('/chats')
        return
      }
    }

    router.refresh()
    setState('idle')
  }

  return (
    <div className="flex gap-2 mt-3">
      <button
        onClick={() => respond('accept')}
        disabled={state === 'loading'}
        className="flex-1 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50"
      >
        Accept
      </button>
      <button
        onClick={() => respond('decline')}
        disabled={state === 'loading'}
        className="flex-1 py-2.5 border border-brand-divider text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.4)] hover:text-[rgba(26,26,26,0.7)] transition-colors disabled:opacity-50"
      >
        Decline
      </button>
    </div>
  )
}
