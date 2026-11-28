'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
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
  const [menuBox, setMenuBox] = useState<{ top: number; right: number } | null>(null)
  const buttonRef = useRef<HTMLButtonElement>(null)
  const menuRef = useRef<HTMLDivElement>(null)

  function placeMenu() {
    const rect = buttonRef.current?.getBoundingClientRect()
    if (!rect) return
    const menuHeight = 40
    const spaceBelow = window.innerHeight - rect.bottom
    const top = spaceBelow < menuHeight + 12 ? rect.top - menuHeight - 4 : rect.bottom + 4
    setMenuBox({ top, right: Math.max(8, window.innerWidth - rect.right) })
  }

  function toggleMenu() {
    if (showMenu) {
      setShowMenu(false)
      return
    }
    placeMenu()
    setShowMenu(true)
  }

  useEffect(() => {
    if (!showMenu) return
    function onPointerDown(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || menuRef.current?.contains(target)) return
      setShowMenu(false)
    }
    function onReposition() {
      placeMenu()
    }
    document.addEventListener('mousedown', onPointerDown)
    window.addEventListener('resize', onReposition)
    window.addEventListener('scroll', onReposition, true)
    return () => {
      document.removeEventListener('mousedown', onPointerDown)
      window.removeEventListener('resize', onReposition)
      window.removeEventListener('scroll', onReposition, true)
    }
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
    <div className={fullWidth ? 'min-w-0 flex-1' : 'flex-shrink-0'}>
      <button
        ref={buttonRef}
        type="button"
        onClick={toggleMenu}
        disabled={loading}
        aria-label="Following"
        aria-expanded={showMenu}
        aria-haspopup="menu"
        className={`${iconButton} ${fullWidth ? 'w-full' : 'w-11'} bg-[#E8748A] border border-[#E8748A] text-[#1a1a1a] hover:bg-[#E8406A]`}
      >
        <Check size={14} />
        {fullWidth && (
          <span className="text-[8px] tracking-[0.12em] uppercase leading-none">Following</span>
        )}
      </button>

      {showMenu && menuBox && createPortal(
        <div
          ref={menuRef}
          role="menu"
          style={{ top: menuBox.top, right: menuBox.right }}
          className="fixed z-40 overflow-hidden rounded-2xl border border-[#1a1a1a]/10 bg-white shadow-lg"
        >
          <button
            type="button"
            role="menuitem"
            onClick={handleUnfollow}
            className="w-full whitespace-nowrap px-4 py-2.5 text-center text-[10px] font-medium uppercase tracking-[0.15em] text-red-500 transition-colors hover:bg-red-50"
          >
            Unfollow
          </button>
        </div>,
        document.body,
      )}
    </div>
  )
}
