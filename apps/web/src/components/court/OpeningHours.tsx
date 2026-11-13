'use client'

import { useState } from 'react'
import { ChevronDown, Clock } from 'lucide-react'

/** One day or hours rule per line. Google joins days with "; ", OSM uses ";" too. */
export function openingHourLines(hours: string): string[] {
  return hours
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

function HoursList({ lines }: { lines: string[] }) {
  return (
    <div className="min-w-0 leading-snug">
      {lines.map((line, index) => (
        <p key={`${index}-${line}`}>{line}</p>
      ))}
    </div>
  )
}

export function OpeningHours({ hours }: { hours: string }) {
  const lines = openingHourLines(hours)
  const [open, setOpen] = useState(false)
  if (lines.length === 0) return null

  // Single rule (same every day / 24/7 / one day) — always expanded.
  if (lines.length === 1) {
    return (
      <div className="flex items-start gap-2 text-[12px] text-[rgba(26,26,26,0.6)]">
        <Clock size={13} className="mt-0.5 flex-shrink-0 text-[rgba(26,26,26,0.35)]" />
        <HoursList lines={lines} />
      </div>
    )
  }

  return (
    <div className="text-[12px] text-[rgba(26,26,26,0.6)]">
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        className="flex w-full items-center gap-2 text-left hover:text-[#1a1a1a] transition-colors"
      >
        <Clock size={13} className="flex-shrink-0 text-[rgba(26,26,26,0.35)]" />
        <span className="flex-1 min-w-0 font-medium tracking-[0.02em]">Hours by day</span>
        <ChevronDown
          size={14}
          className={`flex-shrink-0 text-[rgba(26,26,26,0.4)] transition-transform ${open ? 'rotate-180' : ''}`}
          aria-hidden
        />
      </button>
      {open && (
        <div className="mt-1.5 pl-[21px]">
          <HoursList lines={lines} />
        </div>
      )}
    </div>
  )
}
