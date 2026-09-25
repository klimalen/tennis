'use client'

import { useMemo, useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { skillLabel } from '@/lib/skill'
import { ListSearch } from '@/components/ui/ListSearch'

export interface FollowerProfile {
  id: string
  full_name: string
  username: string | null
  avatar_url: string | null
  city_name: string | null
  skill_level_computed: number | null
  skill_level_self: number | null
}

export function FollowersList({ followers }: { followers: FollowerProfile[] }) {
  const [query, setQuery] = useState('')
  const needle = query.trim().toLowerCase()
  const shown = useMemo(() => {
    if (!needle) return followers
    return followers.filter((follower) => {
      const name = follower.full_name.toLowerCase()
      const username = (follower.username ?? '').toLowerCase()
      return name.includes(needle) || username.includes(needle)
    })
  }, [followers, needle])

  return (
    <div>
      <div className="px-4 pb-3">
        <ListSearch value={query} onChange={setQuery} placeholder="Search by name" />
      </div>
      {shown.length === 0 ? (
        <div className="px-4 py-10 text-center">
          <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)]">No matches</p>
        </div>
      ) : (
        shown.map((follower) => {
          const rating = follower.skill_level_computed ?? follower.skill_level_self
          const label = skillLabel(rating)
          const initials = follower.full_name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
          return (
            <Link
              key={follower.id}
              href={follower.username ? `/profile/${follower.username}` : '#'}
              className="flex items-center gap-4 mx-4 mb-3 px-4 py-3 rounded-[28px] bg-white hover:bg-[#F4F1EC] transition-colors"
            >
              <div className="w-12 h-12 rounded-full bg-[#E8748A] overflow-hidden flex items-center justify-center flex-shrink-0">
                {follower.avatar_url ? (
                  <Image src={follower.avatar_url} alt={follower.full_name} width={48} height={48} className="w-full h-full object-cover" />
                ) : (
                  <span className="font-display text-lg text-[#1a1a1a]">{initials}</span>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-display text-base tracking-wide leading-none text-[#1a1a1a]">{follower.full_name.toUpperCase()}</p>
                {follower.username && (
                  <p className="text-[10px] tracking-[0.12em] text-[rgba(26,26,26,0.4)] mt-0.5">@{follower.username}</p>
                )}
                {follower.city_name && (
                  <p className="text-[10px] text-[rgba(26,26,26,0.35)] mt-0.5">{follower.city_name}</p>
                )}
              </div>
              {label && (
                <span className="text-[8px] tracking-[0.12em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                  {label}
                </span>
              )}
            </Link>
          )
        })
      )}
    </div>
  )
}
