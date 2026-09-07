'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send } from 'lucide-react'

interface Message {
  id: string
  body: string
  created_at: string
  sender_id: string
}

interface Props {
  conversationId: string
  userId: string
  initialMessages: Message[]
}

export function ChatView({ conversationId, userId, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time subscription + mark as read
  useEffect(() => {
    const supabase = createClient()

    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {})

    const channel = supabase
      .channel(`messages:${conversationId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'messages',
          filter: `conversation_id=eq.${conversationId}`,
        },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            // Deduplicate by id (optimistic message already in list)
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // Mark as read when message arrives
          supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .then(() => {})
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, userId])

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')

    // Optimistic: add immediately with a temp id
    const tempId = `temp-${Date.now()}`
    const optimistic: Message = {
      id: tempId,
      body,
      created_at: new Date().toISOString(),
      sender_id: userId,
    }
    setMessages((prev) => [...prev, optimistic])

    const res = await fetch('/api/messages', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ conversation_id: conversationId, body }),
    })

    if (!res.ok) {
      // Roll back optimistic message on error
      setMessages((prev) => prev.filter((m) => m.id !== tempId))
    }
    // Real-time will deliver the real message (with proper id) and deduplicate

    setSending(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  return (
    <>
      {/* Messages */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 space-y-3 overflow-y-auto">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-3">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Game on — say hello!</p>
          </div>
        ) : (
          messages.map((msg) => {
            const isMe = msg.sender_id === userId
            return (
              <div key={msg.id} className={`flex ${isMe ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed ${
                  isMe
                    ? 'bg-brand-primary text-white'
                    : 'bg-brand-surface border border-brand-divider text-[rgba(26,26,26,0.8)]'
                }`}>
                  {msg.body}
                </div>
              </div>
            )
          })
        )}
        <div ref={bottomRef} />
      </div>

      {/* Input */}
      <div className="sticky bottom-20 md:bottom-0 bg-brand-bg border-t border-brand-divider px-4 py-3">
        <div className="max-w-2xl mx-auto flex items-end gap-2">
          <textarea
            ref={inputRef}
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={onKeyDown}
            placeholder="Write a message…"
            rows={1}
            className="flex-1 resize-none bg-brand-surface border border-brand-divider px-3 py-2 text-sm text-[rgba(26,26,26,0.8)] placeholder:text-[rgba(26,26,26,0.3)] outline-none focus:border-brand-primary transition-colors"
            style={{ maxHeight: '120px' }}
          />
          <button
            onClick={send}
            disabled={!text.trim() || sending}
            className="w-10 h-10 bg-brand-primary flex items-center justify-center hover:bg-brand-primary-dark transition-colors disabled:opacity-40 flex-shrink-0"
          >
            <Send size={16} className="text-white" />
          </button>
        </div>
      </div>
    </>
  )
}
