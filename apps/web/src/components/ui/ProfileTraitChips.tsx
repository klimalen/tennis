import { AvailabilityButton } from '@/components/ui/AvailabilityButton'
import { formatPlayFormat, playStyleLabels } from '@/lib/skill'
import type { Availability } from '@/lib/availability'
import { hasSlots } from '@/lib/availability'

const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  carpet: 'Carpet',
  synthetic: 'Synthetic',
}

const chipBase =
  'rounded-full text-[9px] tracking-[0.12em] uppercase font-medium px-2.5 py-0.5'

/** Distinct fills so format / surface / style chips don't read as one flat list. */
const CHIP = {
  skill: `${chipBase} tracking-[0.15em] text-[#F0EBE3] bg-[#3A8A7A]`,
  format: `${chipBase} text-[#1a1a1a] bg-[#F6D9DF]`,
  surface: `${chipBase} text-[#1a1a1a] bg-brand-field`,
  style: `${chipBase} text-[#1a1a1a] bg-[#D7EBE6]`,
} as const

export function ProfileTraitChips({
  skill,
  formats = [],
  surfaces = [],
  playStyle,
  availability,
}: {
  skill?: string | null
  formats?: string[] | null
  surfaces?: string[] | null
  playStyle?: string | null
  availability?: Availability | null
}) {
  const formatLabels = (formats ?? []).map((f) => formatPlayFormat(f)).filter(Boolean)
  const surfaceLabels = (surfaces ?? []).map((s) => SURFACE_LABELS[s] ?? s)
  const styleLabels = playStyleLabels(playStyle)
  const showAvailability = availability != null && hasSlots(availability)

  if (
    !skill
    && formatLabels.length === 0
    && surfaceLabels.length === 0
    && styleLabels.length === 0
    && !showAvailability
  ) {
    return null
  }

  return (
    <div className="mt-2 flex flex-wrap items-center gap-1.5">
      {skill && <span className={CHIP.skill}>{skill}</span>}
      {formatLabels.map((label) => (
        <span key={`format-${label}`} className={CHIP.format}>{label}</span>
      ))}
      {surfaceLabels.map((label) => (
        <span key={`surface-${label}`} className={CHIP.surface}>{label}</span>
      ))}
      {styleLabels.map((label) => (
        <span key={`style-${label}`} className={CHIP.style}>{label}</span>
      ))}
      {showAvailability && availability != null && <AvailabilityButton value={availability} />}
    </div>
  )
}
