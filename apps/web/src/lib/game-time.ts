/** Local calendar helpers for game date and start/end fields. */

export function todayInput(): string {
  const dt = new Date()
  const y = dt.getFullYear()
  const m = String(dt.getMonth() + 1).padStart(2, '0')
  const d = String(dt.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function nowTimeInput(): string {
  const d = new Date()
  d.setMinutes(Math.ceil(d.getMinutes() / 30) * 30, 0, 0)
  const h = String(d.getHours()).padStart(2, '0')
  const m = String(d.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function plusMinutes(time: string, minutes: number): string {
  const parts = time.split(':')
  const h = Number(parts[0] ?? '')
  const m = Number(parts[1] ?? '')
  if (Number.isNaN(h) || Number.isNaN(m)) return time
  const total = ((h * 60 + m + minutes) % (24 * 60) + 24 * 60) % (24 * 60)
  return `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`
}

/** Minutes from start to end. If the end clock is not later, the end is the next day. */
export function durationFromClock(date: string, start: string, end: string): number {
  const startMs = new Date(`${date}T${start}`).getTime()
  let endMs = new Date(`${date}T${end}`).getTime()
  if (Number.isNaN(startMs) || Number.isNaN(endMs)) return 60
  if (endMs <= startMs) endMs += 24 * 60 * 60 * 1000
  return Math.max(1, Math.round((endMs - startMs) / 60000))
}

export function clockFromDuration(iso: string, durationMinutes: number): string {
  const dt = new Date(iso)
  dt.setMinutes(dt.getMinutes() + durationMinutes)
  const h = String(dt.getHours()).padStart(2, '0')
  const m = String(dt.getMinutes()).padStart(2, '0')
  return `${h}:${m}`
}

export function gameEndMs(scheduledAt: string, durationMinutes: number | null | undefined): number {
  const start = new Date(scheduledAt).getTime()
  const mins = durationMinutes && durationMinutes > 0 ? durationMinutes : 90
  return start + mins * 60_000
}

export function parseDurationMinutes(value: unknown): number | null {
  const n = typeof value === 'number' ? value : Number(value)
  if (!Number.isFinite(n)) return null
  const rounded = Math.round(n)
  if (rounded < 1 || rounded > 24 * 60) return null
  return rounded
}
