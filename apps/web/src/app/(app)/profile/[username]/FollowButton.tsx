'use client'

import { useState } from 'react'
import { UserPlus, UserCheck } from 'lucide-react'

interface Props {
  followingId: string
  initialFollowing: boolean
  isMatched: boolean
}

export function FollowButton({ followingId, initialFollowing, isMatched }: Props) {
  const [following, setFollowing] = useState(initialFollowing || isMatched)
  const [loading, setLoading] = useState(false)

  // Matched users are always considered following — button not interactive
  if (isMatched) {
    return (
      <div className="flex items-center gap-1.5 px-4 py-1.5 border border-brand-primary text-brand-primary text-[10px] tracking-[0.15em] uppercase font-medium">
        <UserCheck size={13} />
        Following
      </div>
    )
  }

  async function toggle() {
    if (loading) return
    setLoading(true)
    const method = following ? 'DELETE' : 'POST'
    await fetch('/api/follows', {
      method,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: followingId }),
    })
    setFollowing(!following)
    setLoading(false)
  }

  return (
    <button
      onClick={toggle}
      disabled={loading}
      className={`flex items-center gap-1.5 px-4 py-1.5 border text-[10px] tracking-[0.15em] uppercase font-medium transition-colors disabled:opacity-50 ${
        following
          ? 'border-brand-primary text-brand-primary hover:bg-red-50 hover:border-red-400 hover:text-red-500'
          : 'border-brand-divider text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary'
      }`}
    >
      {following ? <UserCheck size={13} /> : <UserPlus size={13} />}
      {following ? 'Following' : 'Follow'}
    </button>
  )
}
