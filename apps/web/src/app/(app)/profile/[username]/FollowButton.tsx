'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'
import { formatFollowers } from '@/lib/formatFollowers'

interface Props {
  followingId: string
  initialFollowing: boolean
  initialCount: number
  isMatched: boolean
}

export function FollowButton({ followingId, initialFollowing, initialCount, isMatched }: Props) {
  const [following, setFollowing] = useState(initialFollowing || isMatched)
  const [count, setCount] = useState(initialCount)
  const [loading, setLoading] = useState(false)

  async function toggle() {
    if (loading || isMatched) return
    setLoading(true)
    const willFollow = !following
    // Optimistic update
    setFollowing(willFollow)
    setCount((c) => willFollow ? c + 1 : c - 1)

    const res = await fetch('/api/follows', {
      method: willFollow ? 'POST' : 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: followingId }),
    })

    if (!res.ok) {
      // Revert on error
      setFollowing(!willFollow)
      setCount((c) => willFollow ? c - 1 : c + 1)
    }
    setLoading(false)
  }

  return (
    <div className="flex flex-col items-center gap-0.5">
      <button
        onClick={toggle}
        disabled={loading || isMatched}
        className={`flex items-center gap-1.5 px-5 py-3 border text-[10px] tracking-[0.15em] uppercase font-medium transition-colors disabled:opacity-50 ${
          following
            ? 'border-brand-primary text-brand-primary hover:bg-red-50 hover:border-red-400 hover:text-red-500'
            : 'border-brand-divider text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary'
        }`}
      >
        {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
        {following ? 'Following' : 'Follow'}
      </button>
      <span className="text-[8px] tracking-[0.12em] text-[rgba(26,26,26,0.4)]">
        {formatFollowers(count)} followers
      </span>
    </div>
  )
}
