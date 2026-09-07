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
