'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown, UserPlus } from 'lucide-react'

interface Props {
  followingId: string
  initialFollowing: boolean
}

export function FollowButton({ followingId, initialFollowing }: Props) {
  const [following, setFollowing] = useState(initialFollowing)
  const [showMenu, setShowMenu] = useState(false)
  const [loading, setLoading] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showMenu) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setShowMenu(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [showMenu])

  async function handleFollow() {
    if (loading) return
    setLoading(true)
    setFollowing(true)
    const res = await fetch('/api/follows', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: followingId }),
    })
    if (!res.ok) setFollowing(false)
    setLoading(false)
  }

  async function handleUnfollow() {
    setShowMenu(false)
    if (loading) return
    setLoading(true)
    setFollowing(false)
    const res = await fetch('/api/follows', {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ following_id: followingId }),
    })
    if (!res.ok) setFollowing(true)
    setLoading(false)
  }

  if (!following) {
    return (
      <button
        onClick={handleFollow}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-3 border border-brand-divider text-[10px] tracking-[0.15em] uppercase font-medium text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary transition-colors disabled:opacity-50"
      >
        <UserPlus size={13} />
        Follow
      </button>
    )
  }

  return (
    <div ref={menuRef} className="relative">
      <button
        onClick={() => setShowMenu((v) => !v)}
        disabled={loading}
        className="flex items-center gap-1.5 px-4 py-3 border border-brand-primary text-brand-primary text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-brand-primary/5 transition-colors disabled:opacity-50"
      >
        <Check size={13} />
        Following
        <ChevronDown size={10} className={`transition-transform ${showMenu ? 'rotate-180' : ''}`} />
      </button>

      {showMenu && (
        <div className="absolute top-full mt-1 right-0 bg-brand-bg border border-brand-divider shadow-lg z-30 min-w-full">
          <button
            onClick={handleUnfollow}
            className="w-full px-4 py-2.5 text-left text-[10px] tracking-[0.15em] uppercase font-medium text-red-500 hover:bg-red-50 transition-colors whitespace-nowrap"
          >
            Unfollow
          </button>
        </div>
      )}
    </div>
  )
}
