const SURFACE_LABELS: Record<string, string> = {
  hard: 'Hard',
  clay: 'Clay',
  grass: 'Grass',
  carpet: 'Carpet',
  synthetic: 'Synthetic',
}

export type CourtFactTone = 'count' | 'fee' | 'feature'

export type CourtFactChip = {
  key: string
  label: string
  tone: CourtFactTone
}

/** Same pill chrome as court profile facts. */
export const COURT_CHIP_BASE =
  'inline-flex items-center rounded-full px-2.5 py-0.5 text-[9px] font-medium uppercase tracking-[0.12em]'

export const COURT_CHIP_TONE: Record<CourtFactTone, string> = {
  count: 'bg-[#D7EBE6] text-[#1F5C50]',
  fee: 'bg-[#F6D9DF] text-[#7A2F3F]',
  feature: 'bg-brand-field text-[#1a1a1a]',
}

export function buildCourtFactChips({
  courtCount,
  surfaces,
  surface,
  hasIndoor,
  hasOutdoor,
  lit,
  feeHourMin,
  feeHourMax,
  fee,
  accessLabel,
}: {
  courtCount?: number | null | undefined
  surfaces?: string[] | null | undefined
  surface?: string | null | undefined
  hasIndoor?: boolean | null | undefined
  hasOutdoor?: boolean | null | undefined
  lit?: boolean | null | undefined
  feeHourMin?: number | null | undefined
  feeHourMax?: number | null | undefined
  fee?: boolean | null | undefined
  accessLabel?: string | null | undefined
}): CourtFactChip[] {
  const surfaceLabels = (surfaces?.length ? surfaces : surface ? [surface] : [])
    .map((value) => SURFACE_LABELS[value] ?? value.replace(/_/g, ' '))
    .filter(Boolean)
  const settingLabels = [
    hasIndoor ? 'Indoor' : null,
    hasOutdoor ? 'Outdoor' : null,
  ].filter(Boolean) as string[]

  const feeLine = (() => {
    if (feeHourMin == null && feeHourMax == null) return null
    if (feeHourMin != null && feeHourMax != null) {
      if (feeHourMin === feeHourMax) return `${feeHourMin}/hr`
      return `${feeHourMin}–${feeHourMax}/hr`
    }
    if (feeHourMin != null) return `from ${feeHourMin}/hr`
    return `up to ${feeHourMax}/hr`
  })()

  const chips: CourtFactChip[] = []
  if (courtCount != null) {
    chips.push({
      key: 'count',
      label: `${courtCount} court${courtCount === 1 ? '' : 's'}`,
      tone: 'count',
    })
  }
  if (surfaceLabels.length) {
    chips.push({ key: 'surfaces', label: surfaceLabels.join(' · '), tone: 'feature' })
  }
  if (settingLabels.length) {
    chips.push({ key: 'setting', label: settingLabels.join(' · '), tone: 'feature' })
  }
  if (lit === true) chips.push({ key: 'lit', label: 'Lit', tone: 'feature' })
  if (lit === false) chips.push({ key: 'unlit', label: 'Unlit', tone: 'feature' })
  if (feeLine) {
    chips.push({ key: 'fee', label: feeLine, tone: 'fee' })
  } else if (fee === false) {
    chips.push({ key: 'free', label: 'Free', tone: 'feature' })
  } else if (fee === true) {
    chips.push({ key: 'fee', label: 'Fee', tone: 'fee' })
  }
  if (accessLabel) {
    chips.push({ key: 'access', label: accessLabel, tone: 'feature' })
  }
  return chips
}

export function CourtFactChips({
  chips,
  className = 'flex flex-wrap gap-1.5',
}: {
  chips: CourtFactChip[]
  className?: string
}) {
  if (chips.length === 0) return null
  return (
    <div className={className}>
      {chips.map((chip) => (
        <span key={chip.key} className={`${COURT_CHIP_BASE} ${COURT_CHIP_TONE[chip.tone]}`}>
          {chip.label}
        </span>
      ))}
    </div>
  )
}
