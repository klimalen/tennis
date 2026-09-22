'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { MessageCircle, Loader2 } from 'lucide-react'

export function MessageIcon({
  otherUserId,
  existingConvId,
}: {
  otherUserId: string
  existingConvId: string | null
}) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)

  async function handleClick() {
    if (loading) return
    if (existingConvId) {
      router.push(`/chats/${existingConvId}`)
      return
    }
    setLoading(true)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: otherUserId }),
    })
    if (res.ok) {
      const { conversation_id } = await res.json() as { conversation_id: string }
      router.push(`/chats/${conversation_id}`)
    }
    setLoading(false)
  }

  return (
    <button
      onClick={handleClick}
      disabled={loading}
      aria-label="Open chat"
      className="h-11 px-3 rounded-full bg-brand-field border border-[#1a1a1a]/40 flex flex-col items-center justify-center gap-0.5 text-[#1a1a1a] hover:border-[#1a1a1a]/60 transition-colors disabled:opacity-50 flex-shrink-0"
    >
      {loading ? <Loader2 size={14} className="animate-spin" /> : <MessageCircle size={14} />}
      <span className="text-[8px] tracking-[0.12em] uppercase leading-none">Chat</span>
    </button>
  )
}
