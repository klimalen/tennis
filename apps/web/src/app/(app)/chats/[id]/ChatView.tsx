'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, RotateCcw } from 'lucide-react'

interface Message {
  id: string
  body: string
  created_at: string
  sender_id: string
  // client-only fields for status tracking
  _tempId?: string
  _status?: 'sending' | 'sent' | 'error'
}

interface Props {
  conversationId: string
  userId: string
  initialMessages: Message[]
}

function formatTime(iso: string) {
  const d = new Date(iso)
  return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function addMessage(prev: Message[], msg: Message): Message[] {
  if (prev.some((m) => m.id === msg.id || (msg._tempId && m._tempId === msg._tempId))) return prev
  return [...prev, msg]
}

function replaceTemp(prev: Message[], tempId: string, real: Message): Message[] {
  const idx = prev.findIndex((m) => m._tempId === tempId)
  if (idx === -1) return addMessage(prev, real)
  const next = [...prev]
  next[idx] = real
  return next
}

export function ChatView({ conversationId, userId, initialMessages }: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ ...m, _status: 'sent' as const })),
  )
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabaseRef = useRef(createClient())

  // Scroll to bottom on new messages
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages])

  // Real-time subscription + mark as read
  useEffect(() => {
    const supabase = supabaseRef.current

    // Mark as read on open
    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {})

    // postgres_changes — reliable delivery after DB write
    const channel = supabase
      .channel(`chat:${conversationId}`)
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
            // If this matches a temp message (our own send), replace it
            const temp = prev.find(
              (m) => m._status === 'sending' && m.sender_id === msg.sender_id && m.body === msg.body,
            )
            const real: Message = { ...msg, _status: 'sent' }
            if (temp?._tempId) return replaceTemp(prev, temp._tempId, real)
            return addMessage(prev, real)
          })
          // Mark as read when incoming message arrives
          if (msg.sender_id !== userId) {
            supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', userId)
              .then(() => {})
          }
        },
      )
      // Broadcast — low-latency delivery for the other participant
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as Message
        if (msg.sender_id === userId) return // own message, already handled optimistically
        setMessages((prev) => addMessage(prev, { ...msg, _status: 'sent' }))
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, userId])

  async function sendMessage(body: string) {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimistic: Message = {
      id: tempId,
      body,
      created_at: new Date().toISOString(),
      sender_id: userId,
      _tempId: tempId,
      _status: 'sending',
    }
    setMessages((prev) => [...prev, optimistic])

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, body }),
      })

      if (!res.ok) throw new Error('send failed')

      const data = await res.json() as { id: string; created_at: string }

      // Broadcast to other participant for low-latency delivery
      supabaseRef.current.channel(`chat:${conversationId}`).send({
        type: 'broadcast',
        event: 'new_message',
        payload: {
          id: data.id,
          body,
          created_at: data.created_at,
          sender_id: userId,
        },
      })

      // Mark optimistic as sent (postgres_changes will confirm with real id)
      setMessages((prev) =>
        prev.map((m) =>
          m._tempId === tempId ? { ...m, id: data.id, created_at: data.created_at, _status: 'sent' } : m,
        ),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m._tempId === tempId ? { ...m, _status: 'error' } : m)),
      )
    }
  }

  async function send() {
    const body = text.trim()
    if (!body || sending) return
    setSending(true)
    setText('')
    await sendMessage(body)
    setSending(false)
    inputRef.current?.focus()
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault()
      send()
    }
  }

  // Group consecutive messages from the same sender
  const grouped = messages.map((msg, i) => ({
    ...msg,
    isFirst: i === 0 || messages[i - 1]?.sender_id !== msg.sender_id,
    isLast: i === messages.length - 1 || messages[i + 1]?.sender_id !== msg.sender_id,
  }))

  return (
    <>
      {/* Messages */}
      <div className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 overflow-y-auto">
        {grouped.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-3">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">Game on — say hello!</p>
          </div>
        ) : (
          <div className="space-y-0.5">
            {grouped.map((msg) => {
              const isMe = msg.sender_id === userId
              const isError = msg._status === 'error'
              const isSending = msg._status === 'sending'

              return (
                <div
                  key={msg._tempId ?? msg.id}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${msg.isFirst ? 'mt-3' : 'mt-0.5'}`}
                >
                  <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed ${
                    isMe
                      ? isError
                        ? 'bg-red-100 text-red-700 border border-red-200'
                        : 'bg-brand-primary text-white'
                      : 'bg-brand-surface border border-brand-divider text-[rgba(26,26,26,0.8)]'
                  } ${isSending ? 'opacity-60' : ''}`}>
                    {msg.body}
                  </div>

                  {/* Timestamp + status — only on last message in group */}
                  {msg.isLast && (
                    <div className={`flex items-center gap-1.5 mt-0.5 ${isMe ? 'flex-row-reverse' : 'flex-row'}`}>
                      <span className="text-[10px] text-[rgba(26,26,26,0.3)]">
                        {formatTime(msg.created_at)}
                      </span>
                      {isMe && (
                        <>
                          {isSending && (
                            <span className="text-[10px] text-[rgba(26,26,26,0.3)]">Sending…</span>
                          )}
                          {msg._status === 'sent' && (
                            <span className="text-[10px] text-[rgba(26,26,26,0.3)]">Sent</span>
                          )}
                          {isError && (
                            <button
                              onClick={() => {
                                setMessages((prev) => prev.filter((m) => m._tempId !== msg._tempId))
                                sendMessage(msg.body)
                              }}
                              className="flex items-center gap-0.5 text-[10px] text-red-500 hover:text-red-700"
                            >
                              <RotateCcw size={10} />
                              Retry
                            </button>
                          )}
                        </>
                      )}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
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
