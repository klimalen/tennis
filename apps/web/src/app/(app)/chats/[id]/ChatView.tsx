'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { Send, RotateCcw, ChevronDown, Check, CheckCheck, Calendar, MapPin } from 'lucide-react'
import { useRouter } from 'next/navigation'

interface Message {
  id: string
  body: string
  created_at: string
  sender_id: string
  type: 'text' | 'game_invite'
  game_id: string | null
  _tempId?: string
  _status?: 'sending' | 'sent' | 'error'
}

type ParticipantStatus = 'invited' | 'accepted' | 'declined'

interface GameStatus {
  myStatus: ParticipantStatus | 'creator'
  otherStatus: ParticipantStatus | null
}

interface GameDetail {
  id: string
  scheduled_at: string
  format: string
  neighborhood: string | null
  creator_id: string
}

interface Props {
  conversationId: string
  userId: string
  otherUserId: string
  otherName: string
  initialMessages: Message[]
  initialOtherLastReadAt: string | null
  initialGameStatuses: Record<string, GameStatus>
  initialGameDetails: Record<string, GameDetail>
  isMutual: boolean
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

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed doubles',
}

// ─── Game Invite Card ─────────────────────────────────────────────────────────

function GameInviteCard({
  msg,
  isMe,
  gameStatus,
  gameDetail,
  onRespond,
}: {
  msg: Message
  isMe: boolean
  gameStatus: GameStatus | undefined
  gameDetail: GameDetail | undefined
  onRespond: (gameId: string, status: 'accepted' | 'declined') => void
}) {
  const [responding, setResponding] = useState(false)

  // Use live game data if available, fall back to snapshot in msg.body
  let snapshot: { scheduled_at?: string; format?: string; location?: string | null; updated?: boolean } = {}
  try { snapshot = JSON.parse(msg.body) as typeof snapshot } catch { /* ignore */ }
  const isUpdate = snapshot.updated === true

  const source = gameDetail ?? snapshot
  const dt = source.scheduled_at ? new Date(source.scheduled_at) : null
  const dateStr = dt ? dt.toLocaleDateString('en-GB', { weekday: 'short', day: 'numeric', month: 'short' }) : ''
  const timeStr = dt ? dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : ''
  const formatLabel = source.format ? (FORMAT_LABELS[source.format] ?? source.format) : ''
  const location = gameDetail ? gameDetail.neighborhood : snapshot.location

  const myStatus = gameStatus?.myStatus
  const otherStatus = gameStatus?.otherStatus

  const canRespond = !isMe && myStatus === 'invited' && !isUpdate

  async function respond(status: 'accepted' | 'declined') {
    if (!msg.game_id || responding) return
    setResponding(true)
    await onRespond(msg.game_id, status)
    setResponding(false)
  }

  // Status label for the card footer
  function statusBadge() {
    if (isMe) {
      // Show other person's response
      if (otherStatus === 'accepted') return <span className="text-[10px] text-brand-primary font-medium">✓ Accepted</span>
      if (otherStatus === 'declined') return <span className="text-[10px] text-[rgba(26,26,26,0.4)]">Declined</span>
      return <span className="text-[10px] text-[rgba(26,26,26,0.4)]">Waiting for response…</span>
    } else {
      if (myStatus === 'accepted') return <span className="text-[10px] text-brand-primary font-medium">✓ You accepted</span>
      if (myStatus === 'declined') return <span className="text-[10px] text-[rgba(26,26,26,0.4)]">You declined</span>
      return null
    }
  }

  // Game was deleted (ON DELETE SET NULL)
  if (!msg.game_id) {
    return (
      <div className="max-w-[80%] border border-brand-divider bg-brand-bg overflow-hidden opacity-50">
        <div className="px-3 py-2 flex items-center gap-2 bg-brand-surface">
          <Calendar size={12} className="text-[rgba(26,26,26,0.3)] flex-shrink-0" />
          <span className="text-[9px] tracking-[0.15em] uppercase font-medium text-[rgba(26,26,26,0.4)]">Game proposal</span>
        </div>
        <div className="px-3 py-3">
          <p className="text-sm text-[rgba(26,26,26,0.4)] italic">This game has been cancelled</p>
        </div>
      </div>
    )
  }

  return (
    <div className={`max-w-[80%] border bg-brand-bg overflow-hidden ${isMe ? 'border-brand-primary/30' : 'border-brand-divider'}`}>
      {/* Header */}
      <div className={`px-3 py-2 flex items-center gap-2 ${isMe ? 'bg-brand-primary/5' : 'bg-brand-surface'}`}>
        <Calendar size={12} className="text-brand-primary flex-shrink-0" />
        <span className="text-[9px] tracking-[0.15em] uppercase font-medium text-brand-primary">
          {isUpdate ? 'Meeting details updated' : 'Game proposal'}
        </span>
      </div>

      {/* Details */}
      <div className="px-3 py-3 space-y-1">
        <p className="font-display text-lg tracking-wide leading-tight text-[#1a1a1a]">
          {dateStr && timeStr ? `${dateStr} · ${timeStr}` : '—'}
        </p>
        <p className="text-[11px] text-[rgba(26,26,26,0.5)]">{formatLabel}</p>
        {location && (
          <p className="text-[11px] text-[rgba(26,26,26,0.45)] flex items-center gap-1">
            <MapPin size={10} />
            {location}
          </p>
        )}
      </div>

      {/* Actions / status */}
      <div className="px-3 pb-3">
        {canRespond ? (
          <div className="flex gap-2">
            <button onClick={() => respond('accepted')} disabled={responding}
              className="flex-1 py-2 bg-brand-primary text-white text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-brand-primary-dark transition-colors disabled:opacity-50">
              Accept
            </button>
            <button onClick={() => respond('declined')} disabled={responding}
              className="flex-1 py-2 border border-brand-divider text-[10px] tracking-[0.15em] uppercase font-medium text-[rgba(26,26,26,0.5)] hover:border-[rgba(26,26,26,0.3)] transition-colors disabled:opacity-50">
              Decline
            </button>
          </div>
        ) : (
          statusBadge()
        )}
      </div>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export function ChatView({
  conversationId,
  userId,
  otherUserId,
  otherName,
  initialMessages,
  initialOtherLastReadAt,
  initialGameStatuses,
  initialGameDetails,
  isMutual,
}: Props) {
  const [messages, setMessages] = useState<Message[]>(
    initialMessages.map((m) => ({ ...m, _status: 'sent' as const })),
  )
  const [otherLastReadAt, setOtherLastReadAt] = useState<string | null>(initialOtherLastReadAt)
  const [gameStatuses, setGameStatuses] = useState<Record<string, GameStatus>>(initialGameStatuses)
  const [gameDetails, setGameDetails] = useState<Record<string, GameDetail>>(initialGameDetails)
  const [text, setText] = useState('')
  const [sending, setSending] = useState(false)
  const [showScrollBtn, setShowScrollBtn] = useState(false)

  const router = useRouter()

  const scrollRef = useRef<HTMLDivElement>(null)
  const bottomRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLTextAreaElement>(null)
  const supabase = useRef(createClient()).current

  const scrollToBottom = useCallback((smooth = true) => {
    bottomRef.current?.scrollIntoView({ behavior: smooth ? 'smooth' : 'instant' })
    setShowScrollBtn(false)
  }, [])

  useEffect(() => { scrollToBottom(false) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  function handleScroll() {
    const el = scrollRef.current
    if (!el) return
    setShowScrollBtn(el.scrollHeight - el.scrollTop - el.clientHeight > 120)
  }

  // ── Real-time ───────────────────────────────────────────────────────────────

  useEffect(() => {
    supabase
      .from('conversation_participants')
      .update({ last_read_at: new Date().toISOString() })
      .eq('conversation_id', conversationId)
      .eq('user_id', userId)
      .then(() => {})

    const channel = supabase
      .channel(`chat:${conversationId}`)
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
            if (temp?._tempId) return prev.map((m) => m._tempId === temp._tempId ? real : m)
            return addMessage(prev, real)
          })
          if (msg.sender_id !== userId) {
            supabase.from('conversation_participants')
              .update({ last_read_at: new Date().toISOString() })
              .eq('conversation_id', conversationId).eq('user_id', userId).then(() => {})
            const el = scrollRef.current
            if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) scrollToBottom()
          }
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const row = payload.new as { user_id: string; last_read_at: string | null }
          if (row.user_id !== userId) setOtherLastReadAt(row.last_read_at)
        },
      )
      // Game participant status changes (accept/decline)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'game_participants' },
        (payload) => {
          const row = payload.new as { game_id: string; player_id: string; status: ParticipantStatus }
          setGameStatuses((prev) => {
            const existing = prev[row.game_id]
            if (!existing) return prev
            if (row.player_id === userId) {
              return { ...prev, [row.game_id]: { ...existing, myStatus: row.status } }
            }
            if (row.player_id === otherUserId) {
              return { ...prev, [row.game_id]: { ...existing, otherStatus: row.status } }
            }
            return prev
          })
        },
      )
      // Game details changes (reschedule, format, location edits)
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'games' },
        (payload) => {
          const row = payload.new as GameDetail
          setGameDetails((prev) => {
            if (!(row.id in prev)) return prev
            return { ...prev, [row.id]: row }
          })
        },
      )
      .on('broadcast', { event: 'new_message' }, ({ payload }) => {
        const msg = payload as Message
        if (msg.sender_id === userId) return
        setMessages((prev) => addMessage(prev, { ...msg, _status: 'sent' }))
        supabase.from('conversation_participants')
          .update({ last_read_at: new Date().toISOString() })
          .eq('conversation_id', conversationId).eq('user_id', userId).then(() => {})
        const el = scrollRef.current
        if (el && el.scrollHeight - el.scrollTop - el.clientHeight < 200) scrollToBottom()
      })
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [conversationId, userId, otherUserId, supabase, scrollToBottom])

  // ── Send ────────────────────────────────────────────────────────────────────

  const sendMessage = useCallback(async (body: string) => {
    const tempId = `temp-${Date.now()}-${Math.random()}`
    const optimistic: Message = {
      id: tempId, body, created_at: new Date().toISOString(),
      sender_id: userId, type: 'text', game_id: null,
      _tempId: tempId, _status: 'sending',
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
      supabase.channel(`chat:${conversationId}`).send({
        type: 'broadcast', event: 'new_message',
        payload: { id: data.id, body, created_at: data.created_at, sender_id: userId, type: 'text', game_id: null },
      })
      setMessages((prev) => prev.map((m) =>
        m._tempId === tempId ? { ...m, id: data.id, created_at: data.created_at, _status: 'sent' } : m,
      ))
    } catch {
      setMessages((prev) => prev.map((m) => m._tempId === tempId ? { ...m, _status: 'error' } : m))
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
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() }
  }

  async function handleGameRespond(gameId: string, status: 'accepted' | 'declined') {
    // Optimistic update
    setGameStatuses((prev) => ({
      ...prev,
      [gameId]: { myStatus: status, otherStatus: prev[gameId]?.otherStatus ?? null },
    }))
    await fetch(`/api/games/${gameId}/participants`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status }),
    })
  }

  // ── Read receipt ────────────────────────────────────────────────────────────

  const myMessages = messages.filter((m) => m.sender_id === userId && m._status === 'sent')
  const lastReadByOtherIdx = otherLastReadAt
    ? myMessages.reduce((best, m, i) => m.created_at <= otherLastReadAt! ? i : best, -1)
    : -1
  const lastReadByOtherId = lastReadByOtherIdx >= 0 ? myMessages[lastReadByOtherIdx]?.id : null

  // ── Display items ───────────────────────────────────────────────────────────

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
      {messages.length === 0 && otherName && (
        <div className="max-w-2xl w-full mx-auto px-4 pt-6">
          <div className="border border-brand-divider bg-brand-surface px-4 py-4 text-center">
            <p className="font-display text-2xl tracking-wide text-brand-primary mb-1">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.5)] font-medium">
              You matched with {otherName.split(' ')[0]}
            </p>
            <p className="text-sm text-[rgba(26,26,26,0.4)] font-script italic mt-1">Say hello and arrange a game!</p>
          </div>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} onScroll={handleScroll}
        className="flex-1 max-w-2xl w-full mx-auto px-4 py-4 overflow-y-auto relative">
        {items.length > 0 && (
          <div className="space-y-0.5">
            {items.map((item) => {
              if (item.type === 'date') {
                return (
                  <div key={item.key} className="flex items-center gap-3 py-3">
                    <div className="flex-1 h-px bg-brand-divider" />
                    <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.35)] font-medium">{item.label}</span>
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
                <div key={item.key} className={`flex flex-col ${isMe ? 'items-end' : 'items-start'} ${isFirst ? 'mt-3' : 'mt-0.5'}`}>

                  {msg.type === 'game_invite' ? (
                    <GameInviteCard
                      msg={msg}
                      isMe={isMe}
                      gameStatus={msg.game_id ? gameStatuses[msg.game_id] : undefined}
                      gameDetail={msg.game_id ? gameDetails[msg.game_id] : undefined}
                      onRespond={handleGameRespond}
                    />
                  ) : (
                    <div className={`max-w-[75%] px-3 py-2 text-sm leading-relaxed ${
                      isMe
                        ? isError ? 'bg-red-50 text-red-700 border border-red-200' : 'bg-brand-primary text-white'
                        : 'bg-brand-surface border border-brand-divider text-[rgba(26,26,26,0.8)]'
                    } ${isSending ? 'opacity-60' : ''}`}>
                      {msg.body}
                    </div>
                  )}

                  {isLast && (
                    <div className={`flex items-center gap-1 mt-0.5 ${isMe ? 'flex-row' : 'flex-row-reverse'}`}>
                      {isMe && (
                        <span className="flex items-center gap-0.5">
                          {isSending && <span className="text-[10px] text-[rgba(26,26,26,0.3)]">Sending…</span>}
                          {!isSending && !isError && isReadByOther && <CheckCheck size={12} className="text-brand-primary" />}
                          {!isSending && !isError && !isReadByOther && <Check size={12} className="text-[rgba(26,26,26,0.3)]" />}
                          {isError && (
                            <button onClick={() => { setMessages((p) => p.filter((m) => m._tempId !== msg._tempId)); sendMessage(msg.body) }}
                              className="flex items-center gap-0.5 text-[10px] text-red-500 hover:text-red-700">
                              <RotateCcw size={10} />Retry
                            </button>
                          )}
                        </span>
                      )}
                      <span className="text-[10px] text-[rgba(26,26,26,0.3)]">{formatTime(msg.created_at)}</span>
                    </div>
                  )}
                </div>
              )
            })}
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      {showScrollBtn && (
        <div className="absolute bottom-24 right-4 md:right-8 z-10">
          <button onClick={() => scrollToBottom()}
            className="w-9 h-9 bg-brand-primary text-white flex items-center justify-center shadow-lg hover:bg-brand-primary-dark transition-colors">
            <ChevronDown size={18} />
          </button>
        </div>
      )}

      {/* Input area */}
      <div className="sticky bottom-20 md:bottom-0 bg-brand-bg border-t border-brand-divider px-4 pt-2 pb-3">
        <div className="max-w-2xl mx-auto">
          {/* Propose game button */}
          {isMutual ? (
            <>
              <div className="flex mb-2">
                <button
                  onClick={() => router.push(`/games/new?invite=${otherUserId}&name=${encodeURIComponent(otherName)}`)}
                  className="flex items-center gap-1.5 px-3 py-1.5 border border-brand-divider text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary transition-colors"
                >
                  <Calendar size={12} />
                  Propose game
                </button>
              </div>
              <div className="flex items-end gap-2">
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
                <button onClick={send} disabled={!text.trim() || sending}
                  className="w-10 h-10 bg-brand-primary flex items-center justify-center hover:bg-brand-primary-dark transition-colors disabled:opacity-40 flex-shrink-0">
                  <Send size={16} className="text-white" />
                </button>
              </div>
            </>
          ) : (
            <div className="border border-brand-divider bg-brand-surface px-4 py-3 text-center">
              <p className="text-[10px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.4)]">
                Messaging requires a mutual follow
              </p>
            </div>
          )}
        </div>
      </div>
    </>
  )
}
