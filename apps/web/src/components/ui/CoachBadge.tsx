import { GraduationCap } from 'lucide-react'
import { skillLabel } from '@/lib/skill'

/**
 * Large light watermark for profile header cards — flush to the bottom edge
 * (under stats, beside left-aligned meta). Pair with `overflow-hidden` on the card;
 * clipping into the bottom radius is intentional.
 */
export function CoachWatermark({ className = '' }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={`pointer-events-none absolute bottom-0 right-2 z-0 select-none font-display text-[52px] italic font-bold leading-none tracking-[-0.02em] text-[rgba(26,26,26,0.07)] sm:text-[58px] ${className}`}
    >
      COACH
    </span>
  )
}

const markBase = 'inline-flex h-6 shrink-0 items-center gap-1.5 rounded-full px-2.5 text-[12px] font-semibold leading-none'

/** Coach tag for lists and cards. Sits where a player's level would. */
export function CoachBadge({ className = '' }: { className?: string }) {
  return (
    <span className={`${markBase} bg-[#D7EBE6] text-[#2F6B5E] ${className}`}>
      <GraduationCap size={14} strokeWidth={1.9} aria-hidden />
      Coach
    </span>
  )
}

const LEVEL_MARKS: Record<string, { bars: number; color: string }> = {
  Beginner: { bars: 1, color: '#A89078' },
  Intermediate: { bars: 2, color: '#3A8A7A' },
  Advanced: { bars: 3, color: '#E8748A' },
  Competitive: { bars: 4, color: '#D4A017' },
}

/** Signal bars in the level's color, as in the profile level picker. */
export function LevelBars({ level }: { level: string }) {
  const mark = LEVEL_MARKS[level]
  if (!mark) return null
  return (
    <span className="flex h-3 items-end gap-[2px]" aria-hidden>
      {[1, 2, 3, 4].map((bar) => (
        <span
          key={bar}
          className="w-[3px] rounded-full"
          style={{ height: `${bar * 3}px`, background: bar <= mark.bars ? mark.color : 'rgba(26,26,26,0.14)' }}
        />
      ))}
    </span>
  )
}

export function LevelBadge({ level, className = '' }: { level: number | null | undefined; className?: string }) {
  const label = skillLabel(level)
  if (!label) return null
  return (
    <span className={`${markBase} bg-[#F6F1EA] text-[#1a1a1a] ${className}`}>
      <LevelBars level={label} />
      {label}
    </span>
  )
}
