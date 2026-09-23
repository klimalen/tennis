'use client'

import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { CalendarDays } from 'lucide-react'
import {
  DAY_LABELS,
  PART_LABELS,
  daysWithSlots,
  hasSlots,
  normalizeAvailability,
} from '@/lib/availability'

export function AvailabilityButton({ value }: { value: unknown }) {
  const availability = normalizeAvailability(value)
  const days = daysWithSlots(availability)
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState({ top: 0, left: 0 })
  const buttonRef = useRef<HTMLButtonElement>(null)
  const popRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onPointer(e: MouseEvent) {
      const target = e.target as Node
      if (buttonRef.current?.contains(target) || popRef.current?.contains(target)) return
      setOpen(false)
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    document.addEventListener('mousedown', onPointer)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onPointer)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  if (!hasSlots(availability)) return null

  function toggle(e: React.MouseEvent<HTMLButtonElement>) {
    e.preventDefault()
    e.stopPropagation()
    const rect = e.currentTarget.getBoundingClientRect()
    const width = 248
    const height = 36 + days.length * 32
    let left = rect.left
    if (left + width > window.innerWidth - 12) left = window.innerWidth - 12 - width
    if (left < 12) left = 12
    let top = rect.bottom + 6
    if (top + height > window.innerHeight - 12) top = Math.max(12, rect.top - 6 - height)
    setPos({ top, left })
    setOpen((v) => !v)
  }

  return (
    <>
      <button
        ref={buttonRef}
        type="button"
        aria-label="When they usually play"
        aria-expanded={open}
        onClick={toggle}
        className="w-7 h-7 flex-shrink-0 rounded-full bg-brand-field border border-[#1a1a1a]/30 flex items-center justify-center text-[#1a1a1a] hover:border-[#1a1a1a]/60 transition-colors"
      >
        <CalendarDays size={13} />
      </button>
      {open && createPortal(
        <div
          ref={popRef}
          style={{ top: pos.top, left: pos.left }}
          className="fixed z-50 w-[248px] rounded-2xl bg-white border border-[#1a1a1a]/10 shadow-lg p-3"
          onClick={(e) => { e.preventDefault(); e.stopPropagation() }}
        >
          <p className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.45)] mb-2">Usually plays</p>
          <div className="space-y-1.5">
            {days.map((day) => (
              <div key={day} className="flex flex-wrap items-center gap-1.5">
                <span className="w-8 text-[10px] tracking-[0.12em] uppercase font-medium text-[#1a1a1a]">
                  {DAY_LABELS[day]}
                </span>
                {(availability[day] ?? []).map((part) => (
                  <span
                    key={part}
                    className="rounded-full bg-[#E8748A] px-2 py-0.5 text-[9px] tracking-[0.12em] uppercase text-[#1a1a1a]"
                  >
                    {PART_LABELS[part]}
                  </span>
                ))}
              </div>
            ))}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
