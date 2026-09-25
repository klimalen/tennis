'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export function PlayRequestSentButton({
  onCancel,
  compact = false,
}: {
  onCancel: () => void
  compact?: boolean
}) {
  const [open, setOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={menuRef} className="relative w-full">
      <button
        type="button"
        onClick={(e) => {
          e.preventDefault()
          e.stopPropagation()
          setOpen((v) => !v)
        }}
        className={compact
          ? 'w-full h-11 min-w-0 justify-center flex items-center gap-1 px-3 rounded-full bg-[#E8748A] border border-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.12em] uppercase font-medium hover:bg-[#E8406A] transition-colors'
          : 'w-full justify-center flex items-center gap-1.5 px-4 py-3 rounded-full bg-[#E8748A] border border-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-[#E8406A] transition-colors'}
      >
        <Check size={13} className="shrink-0" />
        <span className={compact ? 'truncate' : undefined}>Play request sent</span>
        <ChevronDown size={10} className={`shrink-0 transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className={`absolute top-full mt-1 bg-white border border-[#1a1a1a]/10 rounded-2xl shadow-lg z-30 overflow-hidden ${compact ? 'right-0 w-max' : 'right-0 left-0'}`}>
          <button
            type="button"
            onClick={(e) => {
              e.preventDefault()
              e.stopPropagation()
              setOpen(false)
              onCancel()
            }}
            className="w-full px-4 py-2.5 text-left text-[10px] tracking-[0.15em] uppercase font-medium text-red-500 hover:bg-red-50 transition-colors whitespace-nowrap"
          >
            Cancel request
          </button>
        </div>
      )}
    </div>
  )
}
