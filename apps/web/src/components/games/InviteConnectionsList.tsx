'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Check, Search, X } from 'lucide-react'
import { FormSectionLabel, formPanel, formWell } from '@/components/ui/FormCard'

export interface InviteConnection {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
}

function initialsOf(name: string) {
  return name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
}

export function PlayerAvatar({ name, url }: { name: string; url: string | null }) {
  return (
    <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-avatar">
      {url ? (
        <Image src={url} alt={name} width={36} height={36} className="h-full w-full object-cover" />
      ) : (
        <span className="font-display text-sm text-[#1a1a1a]">{initialsOf(name)}</span>
      )}
    </div>
  )
}

/** A player who is already invited, e.g. the chat partner a game is proposed to. */
export function InvitedPlayerRow({ name }: { name: string }) {
  return (
    <div className="flex items-center gap-3 rounded-[20px] bg-[#F8E6EA] px-2.5 py-2">
      <PlayerAvatar name={name} url={null} />
      <span className="min-w-0 flex-1 truncate text-[14px] font-medium text-[#1a1a1a]">{name}</span>
      <span className="rounded-full bg-white/80 px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.14em] text-[#1a1a1a]">Invited</span>
    </div>
  )
}

/** Checkbox list of mutual connections with search when the list gets long. */
export function InviteConnectionsList({
  connections,
  selectedIds,
  onToggle,
  title,
}: {
  connections: InviteConnection[]
  selectedIds: Set<string>
  onToggle: (id: string) => void
  title: string
}) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const showSearch = connections.length > 6
  const picked = connections.filter((person) => selectedIds.has(person.id)).length

  const filtered = useMemo(() => {
    if (!needle) return connections
    return connections.filter((person) => {
      const name = person.full_name.toLowerCase()
      const username = person.username.toLowerCase()
      return name.includes(needle) || username.includes(needle) || `@${username}`.includes(needle)
    })
  }, [connections, needle])

  return (
    <section>
      <FormSectionLabel hint={picked > 0 ? `${picked} selected` : '(optional)'}>{title}</FormSectionLabel>

      <div className={`${formPanel} p-2`}>
        {showSearch && (
          <label className={`${formWell} relative mb-1.5 flex h-11 items-center gap-2.5 pl-3.5 pr-1.5 focus-within:ring-2 focus-within:ring-brand-primary/40`}>
            <Search size={15} strokeWidth={1.7} className="flex-none text-[rgba(26,26,26,0.4)]" aria-hidden />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by name or @username"
              className="min-w-0 flex-1 bg-transparent text-[14px] text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none [&::-webkit-search-cancel-button]:hidden"
              aria-label="Search connections"
            />
            {query && (
              <button
                type="button"
                onClick={() => setQuery('')}
                className="grid h-8 w-8 flex-none place-items-center rounded-full text-[rgba(26,26,26,0.4)] hover:bg-white/70"
                aria-label="Clear search"
              >
                <X size={14} />
              </button>
            )}
          </label>
        )}

        <div className={`space-y-0.5 ${connections.length > 8 ? 'max-h-72 overflow-y-auto' : ''}`}>
          {filtered.map((person) => {
            const selected = selectedIds.has(person.id)
            return (
              <button
                key={person.id}
                type="button"
                onClick={() => onToggle(person.id)}
                aria-pressed={selected}
                className={`flex w-full items-center gap-3 rounded-[20px] px-2.5 py-2 text-left transition-colors ${
                  selected ? 'bg-[#F8E6EA]' : 'hover:bg-brand-surface'
                }`}
              >
                <PlayerAvatar name={person.full_name} url={person.avatar_url} />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[14px] font-medium text-[#1a1a1a]">{person.full_name}</p>
                  <p className="truncate text-[11.5px] text-[rgba(26,26,26,0.45)]">@{person.username}</p>
                </div>
                <span
                  className={`grid h-6 w-6 flex-none place-items-center rounded-full border-[1.5px] transition-colors ${
                    selected ? 'border-[#E8748A] bg-[#E8748A] text-[#1a1a1a]' : 'border-[#1a1a1a]/20'
                  }`}
                  aria-hidden
                >
                  {selected && <Check size={13} strokeWidth={3} />}
                </span>
              </button>
            )
          })}
          {filtered.length === 0 && (
            <p className="px-2.5 py-3 text-[12.5px] text-[rgba(26,26,26,0.45)]">
              No connections match “{query.trim()}”
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
