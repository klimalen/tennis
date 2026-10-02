'use client'

// Formats a game's scheduled_at ISO string in the user's local timezone.
// Must be a client component — server Node.js defaults to UTC.

export function LocalGameDay({ iso }: { iso: string }) {
  const dt = new Date(iso)
  return <>{dt.getDate()}</>
}

export function LocalGameMonth({ iso }: { iso: string }) {
  const dt = new Date(iso)
  return <>{dt.toLocaleDateString('en-GB', { month: 'short' })}</>
}

export function LocalGameTime({ iso }: { iso: string }) {
  const dt = new Date(iso)
  return <>{dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}</>
}

function gameClock(iso: string, durationMinutes: number | null) {
  const start = new Date(iso)
  const minutes = durationMinutes && durationMinutes > 0 ? durationMinutes : 90
  const end = new Date(start.getTime() + minutes * 60_000)
  const fmt = (dt: Date) => dt.toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })
  return { start, end, startLabel: fmt(start), endLabel: fmt(end) }
}

export function LocalGameTimeRange({ iso, durationMinutes }: { iso: string; durationMinutes: number | null }) {
  const { startLabel, endLabel } = gameClock(iso, durationMinutes)
  return <>{startLabel}–{endLabel}</>
}

/** Date plus start and end, for the ticket stub on an open-game card. */
export function formatGameTicketTime(iso: string, durationMinutes: number | null) {
  const { start, startLabel, endLabel } = gameClock(iso, durationMinutes)
  const dateLabel = start.toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase()
  return { dateLabel, startLabel, endLabel }
}
