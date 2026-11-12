import { Clock } from 'lucide-react'

/** One day or hours rule per line. Google joins days with "; ", OSM uses ";" too. */
export function openingHourLines(hours: string): string[] {
  return hours
    .split(/[;\n]+/)
    .map((part) => part.trim())
    .filter(Boolean)
}

export function OpeningHours({ hours }: { hours: string }) {
  const lines = openingHourLines(hours)
  if (lines.length === 0) return null
  return (
    <div className="flex items-start gap-2 text-[12px] text-[rgba(26,26,26,0.6)]">
      <Clock size={13} className="mt-0.5 flex-shrink-0 text-[rgba(26,26,26,0.35)]" />
      <div className="min-w-0 leading-snug">
        {lines.map((line, index) => (
          <p key={`${index}-${line}`}>{line}</p>
        ))}
      </div>
    </div>
  )
}
