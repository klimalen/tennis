'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { ListSearch } from '@/components/ui/ListSearch'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'

export interface ChatItem {
  id: string
  kind: 'direct' | 'game'
  title: string
  scheduledAt: string | null
  cancelled: boolean
  username: string | null
  avatarUrl: string | null
  initials: string
  memberNames: string[]
  lastMsg: {
    id: string
    body: string
    created_at: string
    sender_id: string
    type?: string
  } | null
  myLastReadAt: string | null
}

interface MutualConnection {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  city_name: string | null
  skill_level_computed: number | null
  skill_level_self: number | null
}

interface Props {
  userId: string
  initialChats: ChatItem[]
}

function formatChatTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  if (date.toDateString() === now.toDateString()) {
    return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })
  }
  const yesterday = new Date(now)
  yesterday.setDate(now.getDate() - 1)
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday'
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function gameSlotLabel(iso: string): string {
  const dt = new Date(iso)
  const month = dt.toLocaleDateString('en-GB', { month: 'short' })
  const time = dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return `${dt.getDate()} ${month} ${time}`
}

function searchTitle(chat: ChatItem): string {
  if (chat.kind !== 'game' || !chat.scheduledAt) return chat.title
  const when = gameSlotLabel(chat.scheduledAt)
  return chat.cancelled ? `${chat.title} ${when} cancelled` : `${chat.title} ${when}`
}

function lastMessageTime(chat: ChatItem): number {
  return chat.lastMsg ? Date.parse(chat.lastMsg.created_at) : 0
}

function byLatestMessage(a: ChatItem, b: ChatItem): number {
  return lastMessageTime(b) - lastMessageTime(a)
}

function hasUnread(chat: ChatItem, userId: string): boolean {
  if (!chat.lastMsg) return false
  if (chat.lastMsg.sender_id === userId) return false
  if (!chat.myLastReadAt) return true
  return chat.lastMsg.created_at > chat.myLastReadAt
}

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}

export function ChatsClient({ userId, initialChats }: Props) {
  const [chats, setChats] = useState<ChatItem[]>(initialChats)
  const [query, setQuery] = useState('')
  const [showCompose, setShowCompose] = useState(false)
  const [connections, setConnections] = useState<MutualConnection[]>([])
  const [allChatsExist, setAllChatsExist] = useState(false)
  const [loadingConnections, setLoadingConnections] = useState(false)
  const [startingChat, setStartingChat] = useState<string | null>(null)
  const router = useRouter()
  const supabase = useRef(createClient()).current

  useEffect(() => {
    // Subscribe to new messages across all conversations
    const channel = supabase
      .channel('chats-list')
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages' },
        (payload) => {
          const msg = payload.new as { id: string; conversation_id: string; body: string; created_at: string; sender_id: string; type?: string }
          setChats((prev) => prev.map((chat) => (
            chat.id === msg.conversation_id
              ? {
                  ...chat,
                  lastMsg: { id: msg.id, body: msg.body, created_at: msg.created_at, sender_id: msg.sender_id, ...(msg.type ? { type: msg.type } : {}) },
                }
              : chat
          )))
        },
      )
      // Track read status changes to clear unread dot
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'conversation_participants' },
        (payload) => {
          const row = payload.new as { conversation_id: string; user_id: string; last_read_at: string | null }
          if (row.user_id !== userId) return
          setChats((prev) =>
            prev.map((c) =>
              c.id === row.conversation_id ? { ...c, myLastReadAt: row.last_read_at } : c,
            ),
          )
        },
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId, supabase])

  async function openCompose() {
    setShowCompose(true)
    setLoadingConnections(true)
    const res = await fetch('/api/connections/mutual')
    const data = await res.json() as { connections: MutualConnection[]; allChatsExist?: boolean }
    setConnections(data.connections)
    setAllChatsExist(data.allChatsExist ?? false)
    setLoadingConnections(false)
  }

  async function startChat(otherUserId: string) {
    setStartingChat(otherUserId)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: otherUserId }),
    })
    if (res.ok) {
      const { conversation_id } = await res.json() as { conversation_id: string }
      setShowCompose(false)
      router.push(`/chats/${conversation_id}`)
    }
    setStartingChat(null)
  }

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">No chats yet</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          When someone accepts your game request, a chat will open here
        </p>
        <Link
          href="/search"
          className="mt-6 px-6 py-2.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors"
        >
          Find players
        </Link>
      </div>
    )
  }

  const needle = query.trim().toLowerCase()
  const ordered = [...chats].sort(byLatestMessage)
  const visible = needle
    ? ordered.filter((chat) => {
        const haystack = [searchTitle(chat), chat.username ?? '', ...chat.memberNames].join(' ').toLowerCase()
        return haystack.includes(needle)
      })
    : ordered

  return (
    <div>
      <div className="px-4 pb-3">
        <ListSearch value={query} onChange={setQuery} placeholder="Search chats" />
      </div>
      {visible.length === 0 ? (
        <p className="px-4 py-8 text-center text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">No matches</p>
      ) : null}
      {visible.map((chat) => {
        const { lastMsg } = chat
        const initials = chat.initials
        let previewBody = lastMsg?.body ?? ''
        if (lastMsg?.type === 'game_invite') {
          try {
            const parsed = JSON.parse(lastMsg.body) as { updated?: boolean }
            previewBody = parsed.updated ? 'Meeting details updated' : 'Confirm participation in a game'
          } catch {
            previewBody = 'Confirm participation in a game'
          }
        }
        const preview = lastMsg
          ? (lastMsg.sender_id === userId ? 'You: ' : '') + previewBody
          : null
        const unread = hasUnread(chat, userId)

        return (
          <Link
            key={chat.id}
            href={`/chats/${chat.id}`}
            onClick={() => {
              // Optimistically clear unread dot on click
              setChats((prev) =>
                prev.map((c) =>
                  c.id === chat.id ? { ...c, myLastReadAt: new Date().toISOString() } : c,
                ),
              )
            }}
            className="flex items-center gap-4 mx-4 mb-3 px-4 py-4 rounded-[28px] bg-white hover:bg-[#F4F1EC] transition-colors"
          >
            {/* Avatar */}
            <div className="w-12 h-12 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center flex-shrink-0">
              {chat.avatarUrl ? (
                <Image src={chat.avatarUrl} alt={chat.title} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-lg text-[#1a1a1a]">{initials}</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <p className={`font-display text-base tracking-wide leading-tight uppercase ${chat.kind === 'game' ? '' : 'truncate'} ${unread ? 'text-[#1a1a1a]' : ''}`}>
                  {chat.title}
                  {chat.kind === 'game' && chat.scheduledAt && (
                    <>
                      {' · '}
                      <LocalGameDay iso={chat.scheduledAt} /> <LocalGameMonth iso={chat.scheduledAt} />
                      {' · '}
                      <LocalGameTime iso={chat.scheduledAt} />
                    </>
                  )}
                  {chat.cancelled ? ' · cancelled' : ''}
                </p>
                {lastMsg && (
                  <span className="text-[10px] text-[rgba(26,26,26,0.35)] flex-shrink-0">{formatChatTime(lastMsg.created_at)}</span>
                )}
              </div>
              {preview ? (
                <p className={`font-copy text-[11px] mt-0.5 truncate ${unread ? 'text-[rgba(26,26,26,0.7)] font-medium' : 'text-[rgba(26,26,26,0.45)]'}`}>
                  {preview}
                </p>
              ) : (
                <p className="text-[10px] tracking-[0.1em] text-[rgba(26,26,26,0.3)] mt-0.5">
                  {chat.kind === 'game'
                    ? (chat.memberNames.join(', ') || 'Game chat')
                    : chat.username ? `@${chat.username}` : ''}
                </p>
              )}
            </div>

            {/* Unread dot */}
            {unread && (
              <div className="w-2.5 h-2.5 rounded-full bg-brand-primary flex-shrink-0" />
            )}
          </Link>
        )
      })}
    </div>
  )
}
