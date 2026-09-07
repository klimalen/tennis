'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, RotateCcw, ChevronDown, Check, CheckCheck } from 'lucide-react'

interface Message {
  id: string
  body: string
  created_at: string
  sender_id: string
  _tempId?: string
  _status?: 'sending' | 'sent' | 'error'
}

interface Props {
  conversationId: string
  userId: string
  otherName: string
  initialMessages: Message[]
  initialOtherLastReadAt: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatTime(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}

function formatDateSeparator(iso: string): string {
  const d = new Date(iso)
  const today = new Date()
  const yesterday = new Date(today)
  yesterday.setDate(today.getDate() - 1)

  if (d.toDateString() === today.toDateString()) return 'Today'
  if (d.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return d.toLocaleDateString([], { day: 'numeric', month: 'short', year: d.getFullYear() !== today.getFullYear() ? 'numeric' : undefined })
}

function sameDay(a: string, b: string) {
  return new Date(a).toDateString() === new Date(b).toDateString()
}

function addMessage(prev: Message[], msg: Message): Message[] {
  if (prev.some((m) => m.id === msg.id)) return prev
  return [...prev, msg]
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatView({
  conversationId,
  userId,
  otherName,
  initialMessages,
  initialOtherLastReadAt,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ ...m, _status: 'sent' as const })),
  )
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(initialOtherLastReadAt)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = useRef(createClient()).current

  // ── Scroll helpers ──────────────────────────────────────────────────────────

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
    setShowScrollBtn(false)
  }, [])

  // Initial scroll — instant
  useEffect(() => { scrollToBottom(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    const distFromBottom = el.scrollHeight - el.scrollTop - el.clientHeight
    setShowScrollBtn(distFromBottom > 120)
  }

  // ── Real-time ───────────────────────────────────────────────────────────────

  useEffect(() => {
    // Mark as read on open
    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {})

    const channel = supabase
      .channel(`chat:${conversationId}`)
      // New messages via postgres_changes
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as Message
          setMessages((prev) => {
            const temp = prev.find(
              (m) => m._status === 'sending' && m.sender_id === msg.sender_id && m.body === msg.body,
            )
            const real: Message = { ...msg, _status: 'sent' }
            if (temp?._tempId) {
              return prev.map((m) => m._tempId === temp._tempId ? real : m)
            }
            return addMessage(prev, real)
          })
          if (msg.sender_id !== userId) {
            supabase
              .from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId)
              .eq('user_id', userId)
              .then(() => {})
            // Auto-scroll if near bottom
            const el = scrollRef.current
            if (el) {
              const dist = el.scrollHeight - el.scrollTop - el.clientHeight
              if (dist < 200) scrollToBottom()
            }
          }
        },
      )
      // Read receipts via postgres_changes on conversation_participants
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string | null }
          if (row.user_id !== userId) {
            setOtherLastReadAt(row.last_read_at)
          }
        },
      )
      // Broadcast — fast delivery for other participant
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as Message
        if (msg.sender_id === userId) return
        setMessages((prev) => addMessage(prev, { ...msg, _status: 'sent' }))
        supabase
          .from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId)
          .eq('user_id', userId)
          .then(() => {})
        const el = scrollRef.current
        if (el) {
          const dist = el.scrollHeight - el.scrollTop - el.clientHeight
          if (dist < 200) scrollToBottom()
        }
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, userId, supabase, scrollToBottom])

  // ── Send ────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (body: string) => {
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
    scrollToBottom()

    try {
      const res = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ conversation_id: conversationId, body }),
      })
      if (!res.ok) throw new Error('send failed')

      const data = await res.json() as { id: string; created_at: string }

      // Broadcast for fast delivery
      supabase.channel(`chat:${conversationId}`).send({
        type: 'broadcast',
        event: 'new_message',
        payload: { id: data.id, body, created_at: data.created_at, sender_id: userId },
      })

      setMessages((prev) =>
        prev.map((m) =>
          m._tempId === tempId
            ? { ...m, id: data.id, created_at: data.created_at, _status: 'sent' }
            : m,
        ),
      )
    } catch {
      setMessages((prev) =>
        prev.map((m) => (m._tempId === tempId ? { ...m, _status: 'error' } : m)),
      )
    }
  }, [conversationId, userId, supabase, scrollToBottom])

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

  // ── Read receipt logic ──────────────────────────────────────────────────────

  // Find the last message sent by me that the other person has read
  const myMessages = messages.filter((m) => m.sender_id === userId && m._status === 'sent')
  const lastReadByOtherIdx = otherLastReadAt
    ? myMessages.reduce((best, m, i) => m.created_at <= otherLastReadAt! ? i : best, -1)
    : -1
  const lastReadByOtherId = lastReadByOtherIdx >= 0 ? myMessages[lastReadByOtherIdx]?.id : null

  // ── Render ──────────────────────────────────────────────────────────────────

  // Build display items with date separators
  type DisplayItem =
    | { type: 'date'; key: string; label: string }
    | { type: 'message'; key: string; msg: Message; isFirst: boolean; isLast: boolean }

  const items: DisplayItem[] = []
  messages.forEach((msg, i) => {
    const prev = messages[i - 1]
    if (!prev || !sameDay(prev.created_at, msg.created_at)) {
      items.push({ type: 'date', key: `date-${msg.id}`, label: formatDateSeparator(msg.created_at) })
    }
    const next = messages[i + 1]
    const isFirst = !prev || prev.sender_id !== msg.sender_id || !sameDay(prev.created_at, msg.created_at)
    const isLast = !next || next.sender_id !== msg.sender_id || !sameDay(msg.created_at, next.created_at)
    items.push({ type: 'message', key: msg._tempId ?? msg.id, msg, isFirst, isLast })
  })

  return (
    <>
      {/* Match context card — shown at top if no messages */}
      {messages.length === 0 && otherName && (
        <div className="max-w-2xl w-full mx-auto px-4 pt-6">
          <div className="border border-brand-divider bg-brand-surface px-4 py-4 text-center">
            <p className="font-display text-2xl tracking-wide text-brand-primary mb-1">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.5)] font-medium">
              You matched with {otherName.split(' ')[0]}
            </p>
            <p className="text-sm text-[rgba(26,26,26,0.4)] font-script italic mt-1">
              Say hello and arrange a game!
            </p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 overflow-y-auto relative"
      >
        {items.length === 0 ? null : (
          <div className="space-y-0.5">
            {items.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-brand-divider" />
                    <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.35)] font-medium">
                      {item.label}
                    </span>
                    <div className="flex-1 h-px bg-brand-divider" />
                  </div>
                )
              }

              const { msg, isFirst, isLast } = item
              const isMe = msg.sender_id === userId
              const isError = msg._status === 'error'
              const isSending = msg._status === 'sending'
              const isReadByOther = msg.id === lastReadByOtherId

              return (
                <div
                  key={item.key}
                  className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isFirst ? 'mt-3' : 'mt-0.5'}`}
                >
                  <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed ${
                    isMe
                      ? isError
                        ? 'bg-red-50 text-red-700 border border-red-200'
                        : 'bg-brand-primary text-white'
                      : 'bg-brand-surface border border-brand-divider text-[rgba(26,26,26,0.8)]'
                  } ${isSending ? 'opacity-60' : ''}`}>
                    {msg.body}
                  </div>

                  {/* Timestamp + status row — only on last in group */}
                  {isLast && (
                    <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                      {isMe && (
                        <span className="flex items-center gap-0.5">
                          {isSending && <span className="text-[10px] text-[rgba(26,26,26,0.3)]">Sending…</span>}
                          {!isSending && !isError && isReadByOther && (
                            <CheckCheck size={12} className="text-brand-primary" />
                          )}
                          {!isSending && !isError && !isReadByOther && (
                            <Check size={12} className="text-[rgba(26,26,26,0.3)]" />
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
                        </span>
                      )}
                      <span className="text-[10px] text-[rgba(26,26,26,0.3)]">
                        {formatTime(msg.created_at)}
                      </span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {/* Scroll to bottom button */}
      {showScrollBtn && (
        <div className="absolute bottom-24 right-4 md:right-8 z-10">
          <button
            onClick={() => scrollToBottom()}
            className="w-9 h-9 bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary-dark transition-colors"
          >
            <ChevronDown size={18} />
          </button>
        </div>
      )}

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
