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
      title="Открыть чат"
      className="w-11 h-11 border border-brand-divider flex items-center justify-center text-[rgba(26,26,26,0.4)] hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50 flex-shrink-0"
    >
      {loading ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
    </button>
  )
}
