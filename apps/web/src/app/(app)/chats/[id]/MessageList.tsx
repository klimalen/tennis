'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'

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

export function MessageList({ conversationId, userId, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(initialMessages)
  const bottomRef = useRef<HTMLDivElement>(null)

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Mark as read + subscribe to new messages
  useEffect(() => {
    const supabase = createClient()

    // Mark conversation as read
    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {})

    // Real-time subscription
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
            if (prev.some((m) => m.id === msg.id)) return prev
            return [...prev, msg]
          })
          // Mark as read immediately when message arrives
          supabase
            .from('conversation_participants')
            .update({ last_read_at: new Date().toISOString() })
            .eq('conversation_id', conversationId)
            .eq('user_id', userId)
            .then(() => {})
        },
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [conversationId, userId])

  if (messages.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 text-center">
        <p className="font-display text-5xl text-brand-surface-lg mb-3">✦</p>
        <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Game on — say hello!</p>
      </div>
    )
  }

  return (
    <>
      {messages.map((msg) => {
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
      })}
      <div ref={bottomRef} />
    </>
  )
}
