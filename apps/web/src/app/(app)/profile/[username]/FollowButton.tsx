'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, UserPlus } from 'lucide-react'

interface Props {
  followingId: string
  initialFollowing: boolean
}

const iconButton =
  'h-11 rounded-full flex flex-col items-center justify-center gap-0.5 flex-shrink-0 transition-colors disabled:opacity-50'

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
        type="button"
        onClick={handleFollow}
        disabled={loading}
        aria-label="Follow"
        className={`${iconButton} px-3 bg-brand-field border border-[#1a1a1a]/40 text-[#1a1a1a] hover:border-[#1a1a1a]/60`}
      >
        <UserPlus size={14} />
        <span className="text-[8px] tracking-[0.12em] uppercase leading-none">Follow</span>
      </button>
    )
  }

  return (
    <div ref={menuRef} className="relative flex-shrink-0">
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        disabled={loading}
        aria-label="Following"
        aria-expanded={showMenu}
        className={`${iconButton} w-11 bg-[#E8748A] border border-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]`}
      >
        <Check size={14} />
      </button>

      {showMenu && (
        <div className="absolute top-full mt-1 right-0 w-max bg-white border border-[#1a1a1a]/10 rounded-2xl shadow-lg z-30 overflow-hidden">
          <button
            type="button"
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
