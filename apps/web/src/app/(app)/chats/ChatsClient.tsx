'use client'

import { useEffect, useRef, useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import Image from 'next/image'
import Link from 'next/link'

export interface ChatItem {
  id: string
  other: {
    id: string
    full_name: string
    username: string
    avatar_url: string | null
  }
  lastMsg: {
    id: string
    body: string
    created_at: string
    sender_id: string
    type?: string
  } | null
  myLastReadAt: string | null
}

interface Props {
  userId: string
  initialChats: ChatItem[]
}

function hasUnread(chat: ChatItem, userId: string): boolean {
  if (!chat.lastMsg) return false
  if (chat.lastMsg.sender_id === userId) return false
  if (!chat.myLastReadAt) return true
  return chat.lastMsg.created_at > chat.myLastReadAt
}

export function ChatsClient({ userId, initialChats }: Props) {
  const [chats, setChats] = useState<ChatItem[]>(initialChats)
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
          setChats((prev) => {
            const idx = prev.findIndex((c) => c.id === msg.conversation_id)
            if (idx === -1) return prev
            const updated = [...prev]
            updated[idx] = {
              ...updated[idx]!,
              lastMsg: { id: msg.id, body: msg.body, created_at: msg.created_at, sender_id: msg.sender_id, type: msg.type },
            }
            // Bubble updated chat to top
            const [chat] = updated.splice(idx, 1)
            return [chat!, ...updated]
          })
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

  if (chats.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
        <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
        <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">No chats yet</p>
        <p className="text-sm text-[rgba(26,26,26,0.4)] max-w-xs font-script italic">
          When someone accepts your game request, a chat will open here.
        </p>
        <Link
          href="/search"
          className="mt-6 px-6 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
        >
          Find players
        </Link>
      </div>
    )
  }

  return (
    <div>
      {chats.map((chat) => {
        const { other, lastMsg } = chat
        const initials = other.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()
        const previewBody = lastMsg?.type === 'game_invite'
          ? 'Confirm participation in a game'
          : lastMsg?.body ?? ''
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
            className="flex items-center gap-4 px-4 py-4 border-b border-brand-divider hover:bg-brand-surface/50 transition-colors"
          >
            {/* Avatar */}
            <div className="w-12 h-12 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
              {other.avatar_url ? (
                <Image src={other.avatar_url} alt={other.full_name} width={48} height={48} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-lg text-[rgba(26,26,26,0.3)]">{initials}</span>
              )}
            </div>

            {/* Text */}
            <div className="flex-1 min-w-0">
              <p className={`font-display text-base tracking-wide leading-tight ${unread ? 'text-[#1a1a1a]' : ''}`}>
                {other.full_name.toUpperCase()}
              </p>
              {preview ? (
                <p className={`text-[11px] mt-0.5 truncate ${unread ? 'text-[rgba(26,26,26,0.7)] font-medium' : 'text-[rgba(26,26,26,0.45)]'}`}>
                  {preview}
                </p>
              ) : (
                <p className="text-[10px] tracking-[0.1em] text-[rgba(26,26,26,0.3)] mt-0.5">@{other.username}</p>
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
