export const DAY_PARTS = ['morning', 'afternoon', 'evening'] as const
export type DayPart = (typeof DAY_PARTS)[number]

export const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0] as const

export const DAY_LABELS: Record<number, string> = {
  1: 'Mon',
  2: 'Tue',
  3: 'Wed',
  4: 'Thu',
  5: 'Fri',
  6: 'Sat',
  0: 'Sun',
}

export const PART_LABELS: Record<DayPart, string> = {
  morning: 'Morning',
  afternoon: 'Afternoon',
  evening: 'Evening',
}

const PART_TIMES: Record<DayPart, { start: string; end: string }> = {
  morning: { start: '06:00', end: '12:00' },
  afternoon: { start: '12:00', end: '17:00' },
  evening: { start: '17:00', end: '21:00' },
}

export type Availability = Partial<Record<number, DayPart[]>>

export type AvailabilityLine = {
  key: string
  label: string
  parts: DayPart[]
  anytime?: boolean
}

const DAY_SET = new Set<number>(DAY_ORDER)

function partsKey(parts: DayPart[]): string {
  return DAY_PARTS.filter((part) => parts.includes(part)).join(',')
}

function sameParts(a: DayPart[], b: DayPart[]): boolean {
  return partsKey(a) === partsKey(b)
}

export function slotFromStart(start: string | null | undefined): DayPart | null {
  if (!start) return null
  const t = start.slice(0, 5)
  if (t < '12:00') return 'morning'
  if (t < '17:00') return 'afternoon'
  return 'evening'
}

export function normalizeAvailability(raw: unknown): Availability {
  if (!raw || typeof raw !== 'object' || Array.isArray(raw)) return {}
  const out: Availability = {}
  for (const [key, value] of Object.entries(raw as Record<string, unknown>)) {
    const day = Number(key)
    if (!DAY_SET.has(day) || !Array.isArray(value)) continue
    const picked = new Set(value.filter((part): part is DayPart => DAY_PARTS.includes(part as DayPart)))
    out[day] = DAY_PARTS.filter((part) => picked.has(part))
  }
  return out
}

export function availabilityFromProfile(row: {
  availability?: unknown
  preferred_days?: number[] | null
  preferred_time_start?: string | null
}): Availability {
  const parsed = normalizeAvailability(row.availability)
  if (Object.keys(parsed).length > 0) return parsed
  const days = row.preferred_days ?? []
  if (days.length === 0) return {}
  const slot = slotFromStart(row.preferred_time_start)
  const out: Availability = {}
  for (const day of days) {
    if (!DAY_SET.has(day)) continue
    out[day] = slot ? [slot] : []
  }
  return out
}

export function hasSlots(availability: Availability): boolean {
  return Object.values(availability).some((slots) => (slots?.length ?? 0) > 0)
}

export function selectedDays(availability: Availability): number[] {
  return DAY_ORDER.filter((day) => availability[day] !== undefined)
}

export function daysWithSlots(availability: Availability): number[] {
  return DAY_ORDER.filter((day) => (availability[day]?.length ?? 0) > 0)
}

/** All seven days, every day-part — “any day, any time”. */
export function isAnytime(availability: Availability): boolean {
  return DAY_ORDER.every((day) => sameParts(availability[day] ?? [], [...DAY_PARTS]))
}

/** All seven days share the same non-empty day-parts. */
export function isUniformWeek(availability: Availability): boolean {
  const days = daysWithSlots(availability)
  if (days.length !== 7) return false
  const sample = availability[days[0]!] ?? []
  if (sample.length === 0) return false
  return days.every((day) => sameParts(availability[day] ?? [], sample))
}

export function uniformParts(availability: Availability): DayPart[] | null {
  if (!isUniformWeek(availability) && !isAnytime(availability)) return null
  return availability[DAY_ORDER[0]] ?? null
}

export function fillWeek(parts: DayPart[]): Availability {
  const slots = DAY_PARTS.filter((part) => parts.includes(part))
  const out: Availability = {}
  for (const day of DAY_ORDER) out[day] = [...slots]
  return out
}

export function anytimeAvailability(): Availability {
  return fillWeek([...DAY_PARTS])
}

/** Compact lines for the Usually plays popup — mirrors court hours grouping. */
export function availabilityLines(availability: Availability): AvailabilityLine[] {
  if (!hasSlots(availability)) return []
  if (isAnytime(availability)) {
    return [{ key: 'anytime', label: 'Any day', parts: [...DAY_PARTS], anytime: true }]
  }
  if (isUniformWeek(availability)) {
    return [{ key: 'everyday', label: 'Every day', parts: availability[DAY_ORDER[0]] ?? [] }]
  }

  const days = daysWithSlots(availability)
  const lines: AvailabilityLine[] = []
  let index = 0
  while (index < days.length) {
    const startDay = days[index]!
    const parts = availability[startDay] ?? []
    let end = index
    while (
      end + 1 < days.length
      && consecutiveInWeek(days[end]!, days[end + 1]!)
      && sameParts(availability[days[end + 1]!] ?? [], parts)
    ) {
      end += 1
    }
    const endDay = days[end]!
    const startLabel = DAY_LABELS[startDay] ?? String(startDay)
    const endLabel = DAY_LABELS[endDay] ?? String(endDay)
    const label = startDay === endDay ? startLabel : `${startLabel}–${endLabel}`
    lines.push({
      key: `${startDay}-${endDay}-${partsKey(parts)}`,
      label,
      parts,
    })
    index = end + 1
  }
  return lines
}

function consecutiveInWeek(a: number, b: number): boolean {
  const ai = DAY_ORDER.indexOf(a as (typeof DAY_ORDER)[number])
  const bi = DAY_ORDER.indexOf(b as (typeof DAY_ORDER)[number])
  return ai >= 0 && bi === ai + 1
}

export function toggleDay(availability: Availability, day: number): Availability {
  const next: Availability = { ...availability }
  if (next[day]) delete next[day]
  else next[day] = []
  return next
}

export function togglePart(availability: Availability, day: number, part: DayPart): Availability {
  const current = availability[day] ?? []
  const picked = new Set(current)
  if (picked.has(part)) picked.delete(part)
  else picked.add(part)
  return { ...availability, [day]: DAY_PARTS.filter((item) => picked.has(item)) }
}

/** Toggle a day-part across every day of the week (same-times mode). */
export function toggleUniformPart(availability: Availability, part: DayPart): Availability {
  const sample = daysWithSlots(availability)[0]
  const current = sample != null ? (availability[sample] ?? []) : []
  const picked = new Set(current)
  if (picked.has(part)) picked.delete(part)
  else picked.add(part)
  const nextParts = DAY_PARTS.filter((item) => picked.has(item))
  if (nextParts.length === 0) return {}
  return fillWeek(nextParts)
}

export function storedAvailability(availability: Availability): Record<string, DayPart[]> {
  const out: Record<string, DayPart[]> = {}
  for (const day of daysWithSlots(availability)) {
    out[String(day)] = availability[day] ?? []
  }
  return out
}

export function legacySchedule(availability: Availability): {
  preferred_days: number[]
  preferred_time_start: string | null
  preferred_time_end: string | null
} {
  const days = daysWithSlots(availability)
  const used = new Set(days.flatMap((day) => availability[day] ?? []))
  const unique = DAY_PARTS.filter((part) => used.has(part))
  const single = unique.length === 1 && days.every((day) => availability[day]?.length === 1)
  const only = unique[0]
  const times = single && only ? PART_TIMES[only] : null
  return {
    preferred_days: days,
    preferred_time_start: times?.start ?? null,
    preferred_time_end: times?.end ?? null,
  }
}
