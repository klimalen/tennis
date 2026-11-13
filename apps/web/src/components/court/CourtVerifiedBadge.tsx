'use client'

import { useEffect, useId, useRef, useState } from 'react'
import { BadgeCheck } from 'lucide-react'

/** Instagram-style micro badge: court-managed / validated catalog card. */
export function CourtVerifiedBadge({ className = '' }: { className?: string }) {
  const [open, setOpen] = useState(false)
  const rootRef = useRef<HTMLSpanElement>(null)
  const tipId = useId()

  useEffect(() => {
    if (!open) return
    function onPointer(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false)
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <span ref={rootRef} className={`relative inline-flex ${className}`}>
      <button
        type="button"
        aria-label="Court-validated listing"
        aria-expanded={open}
        aria-controls={tipId}
        onClick={(event) => {
          event.preventDefault()
          event.stopPropagation()
          setOpen((value) => !value)
        }}
        className="inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[#3897F0] transition-colors hover:bg-[#3897F0]/10"
      >
        <BadgeCheck size={15} strokeWidth={2.25} aria-hidden />
        <span className="sr-only">Verified</span>
      </button>
      {open && (
        <span
          id={tipId}
          role="tooltip"
          className="absolute left-1/2 top-full z-40 mt-2 w-56 -translate-x-1/2 rounded-2xl border border-[#1a1a1a]/10 bg-white px-3 py-2 text-left text-[11px] leading-snug text-[rgba(26,26,26,0.7)] shadow-lg"
        >
          Data validated by the court — this listing is linked to the facility&apos;s GAME.
        </span>
      )}
    </span>
  )
}
