'use client'

import { useEffect, useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, Search, X } from 'lucide-react'
import { skillLabel } from '@/lib/skill'
import { CoachBadge } from '@/components/ui/CoachBadge'

export interface FollowerProfile {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  city_name: string | null
  skill_level_computed: number | null
  skill_level_self: number | null
  is_coach?: boolean | null
}

const controlBase = 'h-9 border transition-colors'
const controlIdle = `${controlBase} border-[#1a1a1a]/15 bg-white text-[#1a1a1a] hover:bg-brand-field`
const controlActive = `${controlBase} border-[#1a1a1a] bg-[#1a1a1a] text-[#FAF7F2]`
const iconBtn = 'flex w-9 items-center justify-center rounded-[12px]'
const panelClass = 'rounded-[20px] border border-[#1a1a1a]/10 bg-white p-3 space-y-2'
const fieldClass =
  'w-full rounded-lg border border-[#1a1a1a]/40 bg-brand-field py-2.5 pl-8 pr-8 text-sm text-[#1a1a1a] outline-none placeholder:text-[rgba(26,26,26,0.4)] focus:border-brand-primary'

export function FollowListView({
  people,
  title,
  backHref,
  emptyTitle,
  emptyBody,
}: {
  people: FollowerProfile[]
  title: string
  backHref: string
  emptyTitle: string
  emptyBody: string
}) {
  const [query, setQuery] = useState('')
  const [searchOpen, setSearchOpen] = useState(false)
  const needle = query.trim().toLowerCase()
  const searchActive = Boolean(needle)
  const canSearch = people.length > 0

  useEffect(() => {
    if (searchActive) setSearchOpen(true)
  }, [searchActive])

  const shown = useMemo(() => {
    if (!needle) return people
    return people.filter((person) => {
      const name = person.full_name.toLowerCase()
      const username = (person.username ?? '').toLowerCase()
      return name.includes(needle) || username.includes(needle)
    })
  }, [people, needle])

  return (
    <div className="min-h-screen">
      <div className="page-header max-w-full !py-3">
        <div className="mx-auto flex min-w-0 max-w-2xl flex-col gap-2">
          <div className="flex min-w-0 items-center gap-1.5">
            <Link
              href={backHref}
              className={`${iconBtn} shrink-0 ${controlIdle} !rounded-full`}
              aria-label="Back"
            >
              <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
            </Link>
            <span className="shrink-0 font-display text-3xl tracking-wide text-[#1a1a1a]">{title}</span>
            <span className="text-[rgba(26,26,26,0.35)] text-sm font-numbers">{people.length}</span>
            {canSearch && (
              <button
                type="button"
                onClick={() => setSearchOpen((open) => !open)}
                className={`ml-auto ${iconBtn} shrink-0 ${searchOpen || searchActive ? controlActive : controlIdle}`}
                aria-expanded={searchOpen}
                aria-label="Search"
              >
                <Search size={15} />
              </button>
            )}
          </div>

          {searchOpen && canSearch && (
            <div className={panelClass}>
              <div className="relative">
                <Search
                  size={14}
                  className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[rgba(26,26,26,0.35)]"
                />
                <input
                  type="search"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search by name"
                  autoFocus
                  className={fieldClass}
                />
                {query && (
                  <button
                    type="button"
                    onClick={() => setQuery('')}
                    className="absolute right-2 top-1/2 flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full text-[rgba(26,26,26,0.45)] hover:bg-white"
                    aria-label="Clear search"
                  >
                    <X size={14} />
                  </button>
                )}
              </div>
            </div>
          )}
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {!canSearch ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">{emptyTitle}</p>
            <p className="text-xs font-fraunces italic text-[#85648F]">{emptyBody}</p>
          </div>
        ) : shown.length === 0 ? (
          <div className="px-4 py-10 text-center">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">No matches</p>
          </div>
        ) : (
          shown.map((person) => {
            const coach = Boolean(person.is_coach)
            const rating = coach ? null : person.skill_level_computed ?? person.skill_level_self
            const label = skillLabel(rating)
            const initials = person.full_name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
            return (
              <Link
                key={person.id}
                href={person.username ? `/profile/${person.username}` : '#'}
                className="flex items-center gap-4 mx-4 mb-3 px-4 py-3 rounded-[28px] bg-white hover:bg-[#F4F1EC] transition-colors"
              >
                <div className="w-12 h-12 rounded-full bg-brand-avatar overflow-hidden flex items-center justify-center flex-shrink-0">
                  {person.avatar_url ? (
                    <Image src={person.avatar_url} alt={person.full_name} width={48} height={48} className="w-full h-full object-cover" />
                  ) : (
                    <span className="font-display text-lg text-[#1a1a1a]">{initials}</span>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-display text-base tracking-wide leading-none text-[#1a1a1a]">{person.full_name.toUpperCase()}</p>
                  {person.username && (
                    <p className="text-[10px] tracking-[0.12em] text-[rgba(26,26,26,0.4)] mt-0.5">@{person.username}</p>
                  )}
                  {person.city_name && (
                    <p className="text-[10px] text-[rgba(26,26,26,0.35)] mt-0.5">{person.city_name}</p>
                  )}
                </div>
                {coach ? (
                  <CoachBadge className="flex-shrink-0" />
                ) : label ? (
                  <span className="text-[8px] tracking-[0.12em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                    {label}
                  </span>
                ) : null}
              </Link>
            )
          })
        )}
      </div>
    </div>
  )
}
