'use client'

const DAYS = [
  { key: 'Mo', label: 'Mon' },
  { key: 'Tu', label: 'Tue' },
  { key: 'We', label: 'Wed' },
  { key: 'Th', label: 'Thu' },
  { key: 'Fr', label: 'Fri' },
  { key: 'Sa', label: 'Sat' },
  { key: 'Su', label: 'Sun' },
] as const

type DayKey = (typeof DAYS)[number]['key']

export type DayHours = {
  open: boolean
  from: string
  to: string
}

export type WeekHours = Record<DayKey, DayHours>

const DEFAULT_SLOT: DayHours = { open: false, from: '08:00', to: '22:00' }

const DAY_ALIASES: Record<string, DayKey> = {
  mo: 'Mo', mon: 'Mo', monday: 'Mo',
  tu: 'Tu', tue: 'Tu', tues: 'Tu', tuesday: 'Tu',
  we: 'We', wed: 'We', wednesday: 'We',
  th: 'Th', thu: 'Th', thur: 'Th', thursday: 'Th',
  fr: 'Fr', fri: 'Fr', friday: 'Fr',
  sa: 'Sa', sat: 'Sa', saturday: 'Sa',
  su: 'Su', sun: 'Su', sunday: 'Su',
}

function emptyWeek(): WeekHours {
  return {
    Mo: { ...DEFAULT_SLOT },
    Tu: { ...DEFAULT_SLOT },
    We: { ...DEFAULT_SLOT },
    Th: { ...DEFAULT_SLOT },
    Fr: { ...DEFAULT_SLOT },
    Sa: { ...DEFAULT_SLOT },
    Su: { ...DEFAULT_SLOT },
  }
}

function normalizeTime(raw: string): string | null {
  const cleaned = raw.trim().replace('.', ':').replace(/[–—]/g, '-')
  const match = cleaned.match(/^(\d{1,2}):(\d{2})$/)
  if (!match) return null
  const hour = Number(match[1])
  const minute = Number(match[2])
  if (hour === 24 && minute === 0) return '24:00'
  if (hour < 0 || hour > 23 || minute < 0 || minute > 59) return null
  return `${String(hour).padStart(2, '0')}:${String(minute).padStart(2, '0')}`
}

function expandDayRange(from: DayKey, to: DayKey): DayKey[] {
  const keys = DAYS.map((day) => day.key)
  const start = keys.indexOf(from)
  const end = keys.indexOf(to)
  if (start < 0 || end < 0) return []
  if (start <= end) return keys.slice(start, end + 1)
  return [...keys.slice(start), ...keys.slice(0, end + 1)]
}

/** Parse free-text / OSM-style hours into per-day slots. Unknown text → empty week. */
export function parseOpeningHours(raw: string | null | undefined): WeekHours {
  const week = emptyWeek()
  if (!raw?.trim()) return week

  const chunks = raw.split(/[;\n]+/).map((part) => part.trim()).filter(Boolean)
  for (const chunk of chunks) {
    const match = chunk.match(/^([A-Za-z]{2,9})(?:\s*[–—\-]\s*([A-Za-z]{2,9}))?\s+(.+)$/)
    if (!match) continue
    const fromRaw = match[1]
    const toRaw = match[2]
    const restRaw = match[3]
    if (!fromRaw || !restRaw) continue
    const fromKey = DAY_ALIASES[fromRaw.toLowerCase()]
    const toKey = toRaw ? DAY_ALIASES[toRaw.toLowerCase()] : fromKey
    if (!fromKey || !toKey) continue
    const rest = restRaw.trim().toLowerCase()
    if (rest === 'closed' || rest === 'off') {
      for (const day of expandDayRange(fromKey, toKey)) week[day] = { ...DEFAULT_SLOT, open: false }
      continue
    }
    const times = rest.match(/(\d{1,2}[:.]\d{2})\s*[–—\-]\s*(\d{1,2}[:.]\d{2}|24:00)/)
    if (!times?.[1] || !times[2]) continue
    const from = normalizeTime(times[1])
    const to = normalizeTime(times[2] === '24:00' ? '24:00' : times[2])
    if (!from || !to) continue
    for (const day of expandDayRange(fromKey, toKey)) {
      week[day] = { open: true, from, to }
    }
  }
  return week
}

/** Serialize day slots to OSM-like text: `Mo 08:00-22:00; Tu 08:00-22:00`. */
export function serializeOpeningHours(week: WeekHours): string {
  return DAYS
    .filter((day) => week[day.key].open)
    .map((day) => {
      const slot = week[day.key]
      return `${day.key} ${slot.from}-${slot.to}`
    })
    .join('; ')
}

const timeClass = 'w-[5.5rem] px-2 py-1.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-brand-primary'

export function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const week = parseOpeningHours(value)

  function patch(day: DayKey, partial: Partial<DayHours>) {
    const next: WeekHours = {
      ...week,
      [day]: { ...week[day], ...partial },
    }
    onChange(serializeOpeningHours(next))
  }

  function applyToAllOpen() {
    const sample = DAYS.map((day) => week[day.key]).find((slot) => slot.open) ?? { ...DEFAULT_SLOT, open: true }
    const next = emptyWeek()
    for (const day of DAYS) {
      next[day.key] = { open: true, from: sample.from, to: sample.to }
    }
    onChange(serializeOpeningHours(next))
  }

  function clearAll() {
    onChange('')
  }

  return (
    <div className="space-y-2">
      {DAYS.map((day) => {
        const slot = week[day.key]
        return (
          <div key={day.key} className="flex flex-wrap items-center gap-2">
            <span className="w-9 text-[10px] tracking-[0.14em] uppercase font-medium text-[rgba(26,26,26,0.55)]">
              {day.label}
            </span>
            <button
              type="button"
              onClick={() => patch(day.key, { open: !slot.open })}
              className={`px-2.5 py-1 text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${
                slot.open
                  ? 'rounded-full bg-[#E8748A] text-[#1a1a1a] border-[#E8748A]'
                  : 'rounded-full bg-brand-field text-[rgba(26,26,26,0.55)] border-[#1a1a1a]/40'
              }`}
            >
              {slot.open ? 'Open' : 'Closed'}
            </button>
            {slot.open && (
              <>
                <input
                  type="time"
                  value={slot.from === '24:00' ? '00:00' : slot.from}
                  onChange={(e) => patch(day.key, { from: e.target.value || '08:00' })}
                  className={timeClass}
                  aria-label={`${day.label} opens`}
                />
                <span className="text-[11px] text-[rgba(26,26,26,0.4)]">–</span>
                <input
                  type="time"
                  value={slot.to === '24:00' ? '23:59' : slot.to}
                  onChange={(e) => patch(day.key, { to: e.target.value || '22:00' })}
                  className={timeClass}
                  aria-label={`${day.label} closes`}
                />
              </>
            )}
          </div>
        )
      })}
      <div className="flex flex-wrap gap-3 pt-1">
        <button
          type="button"
          onClick={applyToAllOpen}
          className="text-[10px] tracking-[0.14em] uppercase font-medium text-brand-primary"
        >
          Same hours every day
        </button>
        <button
          type="button"
          onClick={clearAll}
          className="text-[10px] tracking-[0.14em] uppercase font-medium text-[rgba(26,26,26,0.45)]"
        >
          Clear
        </button>
      </div>
    </div>
  )
}
