/** Local YYYY-MM-DD for a game's scheduled start. */
export function localDayKey(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return ''
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function countGamesByDay(scheduledAts: string[]): Map<string, number> {
  const counts = new Map<string, number>()
  for (const iso of scheduledAts) {
    const key = localDayKey(iso)
    if (!key) continue
    counts.set(key, (counts.get(key) ?? 0) + 1)
  }
  return counts
}

/** Monday = 0 … Sunday = 6 (Europe-friendly columns). */
function mondayIndex(date: Date): number {
  return (date.getDay() + 6) % 7
}

function startOfLocalDay(date: Date): Date {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate())
}

function addDays(date: Date, days: number): Date {
  const next = new Date(date)
  next.setDate(next.getDate() + days)
  return next
}

function dayKeyFromDate(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export type HeatLevel = 0 | 1 | 2 | 3

export function heatLevel(count: number): HeatLevel {
  if (count <= 0) return 0
  if (count === 1) return 1
  if (count === 2) return 2
  return 3
}

export interface HeatCell {
  key: string
  date: Date
  count: number
  level: HeatLevel
  /** Outside the trailing window (leading days of first week). */
  inRange: boolean
}

export interface HeatWeek {
  cells: HeatCell[]
  /** Month label for the first day of this week when the month changes. */
  monthLabel: string | null
}

export interface ActivityHeatmapModel {
  weeks: HeatWeek[]
  totalGames: number
  activeDays: number
  weekCount: number
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'] as const

/**
 * GitHub-style grid for the last `weekCount` weeks ending this week (Mon–Sun).
 * Counts games by local calendar day of `scheduled_at`.
 */
export function buildActivityHeatmap(
  scheduledAts: string[],
  weekCount = 26,
  now = new Date(),
): ActivityHeatmapModel {
  const counts = countGamesByDay(scheduledAts)
  const today = startOfLocalDay(now)
  const thisMonday = addDays(today, -mondayIndex(today))
  const rangeStart = addDays(thisMonday, -(weekCount - 1) * 7)
  const gridStart = rangeStart

  const weeks: HeatWeek[] = []
  let prevMonth = -1
  let activeDays = 0
  let totalInWindow = 0

  for (let w = 0; w < weekCount; w++) {
    const weekStart = addDays(gridStart, w * 7)
    const cells: HeatCell[] = []
    for (let d = 0; d < 7; d++) {
      const date = addDays(weekStart, d)
      const key = dayKeyFromDate(date)
      const inRange = date >= rangeStart && date <= today
      const count = inRange ? (counts.get(key) ?? 0) : 0
      if (inRange && count > 0) {
        activeDays += 1
        totalInWindow += count
      }
      cells.push({
        key,
        date,
        count: inRange ? count : 0,
        level: inRange ? heatLevel(count) : 0,
        inRange,
      })
    }
    const month = weekStart.getMonth()
    const monthLabel = month !== prevMonth ? MONTHS[month]! : null
    prevMonth = month
    weeks.push({ cells, monthLabel })
  }

  return {
    weeks,
    totalGames: totalInWindow,
    activeDays,
    weekCount,
  }
}
