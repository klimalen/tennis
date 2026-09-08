'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { SquarePen, X, Loader2 } from 'lucide-react'
import Image from 'next/image'

interface Connection {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
  city_name: string | null
  skill_level_computed: number | null
  skill_level_self: number | null
}

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}

export function ComposeButton() {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [connections, setConnections] = useState<Connection[]>([])
  const [allChatsExist, setAllChatsExist] = useState(false)
  const [starting, setStarting] = useState<string | null>(null)
  const router = useRouter()

  async function handleOpen() {
    setOpen(true)
    setLoading(true)
    const res = await fetch('/api/connections/mutual')
    const data = await res.json() as { connections: Connection[]; allChatsExist?: boolean }
    setConnections(data.connections)
    setAllChatsExist(data.allChatsExist ?? data.connections.length === 0)
    setLoading(false)
  }

  function handleClose() {
    setOpen(false)
    setConnections([])
    setAllChatsExist(false)
  }

  async function startChat(otherUserId: string) {
    setStarting(otherUserId)
    const res = await fetch('/api/conversations', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ other_user_id: otherUserId }),
    })
    if (res.ok) {
      const { conversation_id } = await res.json() as { conversation_id: string }
      handleClose()
      router.push(`/chats/${conversation_id}`)
    }
    setStarting(null)
  }

  return (
    <>
      <button
        onClick={handleOpen}
        className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors"
        title="New chat"
      >
        <SquarePen size={16} className="text-[rgba(26,26,26,0.5)]" />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col justify-end md:justify-center md:items-center">
          {/* Backdrop */}
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={handleClose} />

          {/* Sheet */}
          <div className="relative bg-brand-bg border-t md:border border-brand-divider w-full md:max-w-sm md:rounded-none shadow-xl z-10 max-h-[70vh] flex flex-col">
            {/* Header */}
            <div className="flex items-center justify-between px-4 py-4 border-b border-brand-divider flex-shrink-0">
              <span className="font-display text-2xl tracking-wide">NEW CHAT</span>
              <button onClick={handleClose} className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.4)] hover:text-[#1a1a1a] transition-colors">
                <X size={18} />
              </button>
            </div>

            {/* Content */}
            <div className="overflow-y-auto flex-1">
              {loading ? (
                <div className="flex items-center justify-center py-16">
                  <Loader2 size={20} className="animate-spin text-brand-primary" />
                </div>
              ) : allChatsExist || connections.length === 0 ? (
                <div className="flex flex-col items-center justify-center py-12 px-6 text-center">
                  <p className="font-display text-4xl text-brand-surface-lg mb-3">✦</p>
                  <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">
                    {allChatsExist
                      ? 'You\'re already chatting with all your connections'
                      : 'No mutual connections yet'}
                  </p>
                  <p className="text-xs text-[rgba(26,26,26,0.3)] font-script italic mt-1">
                    {allChatsExist
                      ? 'New connections will appear here once you follow each other'
                      : 'Follow players who follow you back to start a chat'}
                  </p>
                </div>
              ) : (
                connections.map((c) => {
                  const rating = c.skill_level_computed ?? c.skill_level_self
                  const rounded = rating ? Math.round(rating * 2) / 2 : null
                  const skillLabel = rounded ? SKILL_LABELS[rounded] : null
                  const initials = c.full_name.split(' ').map((w) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

                  return (
                    <button
                      key={c.id}
                      onClick={() => startChat(c.id)}
                      disabled={starting === c.id}
                      className="w-full flex items-center gap-4 px-4 py-3 border-b border-brand-divider hover:bg-brand-surface transition-colors text-left disabled:opacity-60"
                    >
                      <div className="w-11 h-11 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                        {c.avatar_url ? (
                          <Image src={c.avatar_url} alt={c.full_name} width={44} height={44} className="w-full h-full object-cover" />
                        ) : (
                          <span className="font-display text-base text-[rgba(26,26,26,0.3)]">{initials}</span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-display text-base tracking-wide leading-none text-[#1a1a1a]">{c.full_name.toUpperCase()}</p>
                        {c.city_name && (
                          <p className="text-[10px] text-[rgba(26,26,26,0.4)] mt-0.5">{c.city_name}</p>
                        )}
                      </div>
                      {skillLabel && (
                        <span className="text-[8px] tracking-[0.12em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                          {skillLabel}
                        </span>
                      )}
                      {starting === c.id && (
                        <Loader2 size={14} className="animate-spin text-brand-primary flex-shrink-0" />
                      )}
                    </button>
                  )
                })
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
