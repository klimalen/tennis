'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { PlayRequestSentButton } from '@/components/ui/PlayRequestSentButton'

type ButtonState = 'idle' | 'loading' | 'sent' | 'declined' | 'connected'

function statusToState(status: string | null): ButtonState {
  if (status === 'pending') return 'sent'
  if (status === 'accepted' || status === 'matched') return 'connected'
  if (status === 'declined') return 'declined'
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

  async function sendRequest() {
    setState('loading')
    const res = await fetch('/api/game-requests', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ receiver_id: receiverId }),
    })
    if (!res.ok) {
      setState(statusToState(existingStatus) === 'declined' ? 'declined' : 'idle')
      return
    }
    const data = await res.json() as { matched: boolean }
    setState(data.matched ? 'connected' : 'sent')
  }

  async function cancelRequest() {
    setState('idle')
    const res = await fetch(`/api/game-requests?receiver_id=${receiverId}`, { method: 'DELETE' })
    if (!res.ok) setState('sent')
  }

  function handleClick() {
    if (state === 'connected') {
      router.push(`/games/new?invite=${receiverId}&name=${encodeURIComponent(receiverName)}`)
      return
    }
    if (state === 'idle' || state === 'declined') void sendRequest()
  }

  const label =
    state === 'loading' ? 'Sending…' :
    state === 'declined' ? 'Try again' :
    state === 'connected' ? 'Plan a game' :
    'Play together'

  const helper =
    state === 'sent' ? 'Waiting for them to accept a game' :
    state === 'declined' ? 'They declined. You can send the request again.' :
    state === 'connected' ? 'You can chat and plan a game. You follow each other now.' :
    'They need to accept before a chat opens.'

  return (
    <div className="space-y-1.5">
      {state === 'sent' ? (
        <PlayRequestSentButton onCancel={() => void cancelRequest()} />
      ) : (
        <button
          type="button"
          onClick={handleClick}
          disabled={state === 'loading'}
          className="w-full py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors disabled:opacity-60 disabled:cursor-default"
        >
          {label}
        </button>
      )}
      <p className="text-[11px] text-[rgba(26,26,26,0.45)] leading-snug">{helper}</p>
    </div>
  )
}
