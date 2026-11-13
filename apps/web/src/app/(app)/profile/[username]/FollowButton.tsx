'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, UserPlus } from 'lucide-react'

interface Props {
  followingId: string
  initialFollowing: boolean
  /** Stretch across the row (court profiles without a primary CTA). */
  fullWidth?: boolean
}

const iconButton =
  'h-11 rounded-full flex flex-col items-center justify-center gap-0.5 transition-colors disabled:opacity-50'

export function FollowButton({ followingId, initialFollowing, fullWidth = false }: Props) {
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
        className={`${iconButton} ${fullWidth ? 'w-full flex-1' : 'flex-shrink-0 px-3'} bg-brand-field border border-[#1a1a1a]/40 text-[#1a1a1a] hover:border-[#1a1a1a]/60`}
      >
        <UserPlus size={14} />
        <span className="text-[8px] tracking-[0.12em] uppercase leading-none">Follow</span>
      </button>
    )
  }

  return (
    <div ref={menuRef} className={`relative ${fullWidth ? 'min-w-0 flex-1' : 'flex-shrink-0'}`}>
      <button
        type="button"
        onClick={() => setShowMenu((v) => !v)}
        disabled={loading}
        aria-label="Following"
        aria-expanded={showMenu}
        className={`${iconButton} ${fullWidth ? 'w-full' : 'w-11'} bg-[#E8748A] border border-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]`}
      >
        <Check size={14} />
        {fullWidth && (
          <span className="text-[8px] tracking-[0.12em] uppercase leading-none">Following</span>
        )}
      </button>

      {showMenu && (
        <div className="absolute left-1/2 top-full z-30 mt-1 w-max -translate-x-1/2 overflow-hidden rounded-2xl border border-[#1a1a1a]/10 bg-white shadow-lg">
          <button
            type="button"
            onClick={handleUnfollow}
            className="w-full whitespace-nowrap px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-red-500 transition-colors hover:bg-red-50"
          >
            Unfollow
          </button>
        </div>
      )}
    </div>
  )
}
