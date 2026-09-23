'use client'

import { useEffect, useRef, useState } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export function PlayRequestSentButton({ onCancel }: { onCancel: () => void }) {
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
        className="w-full justify-center flex items-center gap-1.5 px-4 py-3 rounded-full bg-[#E8748A] border border-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.15em] uppercase font-medium hover:bg-[#E8406A] transition-colors"
      >
        <Check size={13} />
        Play request sent
        <ChevronDown size={10} className={`transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>

      {open && (
        <div className="absolute top-full mt-1 right-0 left-0 bg-white border border-[#1a1a1a]/10 rounded-2xl shadow-lg z-30 overflow-hidden">
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
