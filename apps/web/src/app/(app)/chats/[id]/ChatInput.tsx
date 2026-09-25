'use client'

import { useState, useRef } from 'react'
import { useRouter } from 'next/navigation'
import { Send } from 'lucide-react'

export function ChatInput({ conversationId }: { conversationId: string }) {
  const router = useRouter()
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)

    await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, body }),
    })

    setText('')
    setSending(false)
    router.refresh()
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <div className="sticky bottom-0 bg-brand-bg border-t border-brand-divider px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
      <div className="max-w-2xl mx-auto flex items-end gap-2">
        <textarea
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder="Write a message…"
          rows={1}
          className="font-copy flex-1 resize-none bg-brand-field border border-[#1a1a1a]/40 rounded-lg px-3 py-2 text-sm text-[rgba(26,26,26,0.8)] placeholder:text-[rgba(26,26,26,0.3)] outline-none focus:border-brand-primary transition-colors"
          style={{ maxHeight: '120px' }}
        />
        <button
          onClick={send}
          disabled={!text.trim() || sending}
          className="w-10 h-10 rounded-full bg-[#E8748A] text-[#1a1a1a] flex items-center justify-center hover:bg-[#E8406A] transition-colors disabled:opacity-40 flex-shrink-0"
        >
          <Send size={16} className="text-[#1a1a1a]" />
        </button>
      </div>
    </div>
  )
}
