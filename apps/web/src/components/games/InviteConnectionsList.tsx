'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import { Search, X } from 'lucide-react'

export interface InviteConnection {
  id: string
  full_name: string
  username: string
  avatar_url: string | null
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

  const filtered = useMemo(() => {
    if (!needle) return connections
    return connections.filter((person) => {
      const name = person.full_name.toLowerCase()
      const username = person.username.toLowerCase()
      return name.includes(needle) || username.includes(needle) || `@${username}`.includes(needle)
    })
  }, [connections, needle])

  return (
    <div>
      <p className="mb-3 text-[9px] font-medium uppercase tracking-[0.2em] text-[rgba(26,26,26,0.35)]">
        {title}{' '}
        <span className="normal-case tracking-normal text-[rgba(26,26,26,0.25)]">(optional)</span>
      </p>

      {showSearch && (
        <div className="relative mb-3">
          <Search size={14} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.35)]" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search by name or @username"
            className="h-11 w-full rounded-full border border-[#1a1a1a]/40 bg-brand-field py-0 pl-9 pr-10 text-base text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.3)] focus:border-brand-primary focus:outline-none"
            aria-label="Search connections"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery('')}
              className="absolute right-2 top-1/2 flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full text-[rgba(26,26,26,0.4)] hover:bg-white/60"
              aria-label="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </div>
      )}

      <div className={`space-y-2 ${connections.length > 8 ? 'max-h-72 overflow-y-auto pr-0.5' : ''}`}>
        {filtered.map((person) => {
          const selected = selectedIds.has(person.id)
          const initials = person.full_name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
          return (
            <button
              key={person.id}
              type="button"
              onClick={() => onToggle(person.id)}
              className={`flex w-full items-center gap-3 border px-3 py-3 text-left transition-colors ${
                selected
                  ? 'rounded-[20px] border-[#E8748A] bg-[#F8E6EA]'
                  : 'rounded-[20px] border-[#1a1a1a]/15 bg-brand-field hover:border-[#1a1a1a]/35'
              }`}
            >
              <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-brand-avatar">
                {person.avatar_url ? (
                  <Image src={person.avatar_url} alt={person.full_name} width={36} height={36} className="h-full w-full object-cover" />
                ) : (
                  <span className="font-display text-sm text-[#1a1a1a]">{initials}</span>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium text-[#1a1a1a]">{person.full_name}</p>
                <p className="text-[11px] text-[rgba(26,26,26,0.4)]">@{person.username}</p>
              </div>
              <div
                className={`flex h-5 w-5 flex-shrink-0 items-center justify-center border transition-colors ${
                  selected ? 'rounded-md border-[#E8748A] bg-[#E8748A]' : 'rounded-md border-[#1a1a1a]/25 bg-white'
                }`}
              >
                {selected && <span className="text-[10px] font-bold text-[#1a1a1a]">✓</span>}
              </div>
            </button>
          )
        })}
        {filtered.length === 0 && (
          <p className="px-1 py-3 text-[12px] text-[rgba(26,26,26,0.45)]">
            No connections match “{query.trim()}”.
          </p>
        )}
      </div>
    </div>
  )
}
