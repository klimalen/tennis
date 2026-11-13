'use client'

import { useMemo, useState } from 'react'

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
const ALL_DAY: DayHours = { open: true, from: '00:00', to: '24:00' }

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
  if (!match?.[1] || !match[2]) return null
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
    if (rest === '24/7' || rest === 'open 24 hours' || rest === '24 hours') {
      for (const day of expandDayRange(fromKey, toKey)) week[day] = { ...ALL_DAY }
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
  const openDays = DAYS.filter((day) => week[day.key].open)
  if (openDays.length === 7 && openDays.every((day) => week[day.key].from === '00:00' && (week[day.key].to === '24:00' || week[day.key].to === '23:59'))) {
    return 'Mo-Su 00:00-24:00'
  }
  return openDays
    .map((day) => {
      const slot = week[day.key]
      return `${day.key} ${slot.from}-${slot.to}`
    })
    .join('; ')
}

function isAlwaysOpen(week: WeekHours): boolean {
  return DAYS.every((day) => {
    const slot = week[day.key]
    return slot.open && slot.from === '00:00' && (slot.to === '24:00' || slot.to === '23:59')
  })
}

function isUniformOpen(week: WeekHours): boolean {
  const open = DAYS.map((day) => week[day.key]).filter((slot) => slot.open)
  if (open.length < 2) return open.length === 1
  const sample = open[0]
  if (!sample) return false
  return open.every((slot) => slot.from === sample.from && slot.to === sample.to) && open.length === 7
}

const timeClass = 'w-[5.5rem] px-2 py-1.5 rounded-lg border border-[#1a1a1a]/40 bg-brand-field text-sm text-[#1a1a1a] focus:outline-none focus:ring-2 focus:ring-brand-primary'

function ToggleRow({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean
  label: string
  hint?: string
  onChange: (next: boolean) => void
}) {
  return (
    <label className="flex items-start gap-3 cursor-pointer select-none">
      <input
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
        className="mt-0.5 h-4 w-4 rounded border-[#1a1a1a]/40 accent-[#E8748A]"
      />
      <span>
        <span className="block text-[12px] font-medium text-[#1a1a1a]">{label}</span>
        {hint ? <span className="block text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">{hint}</span> : null}
      </span>
    </label>
  )
}

export function OpeningHoursEditor({
  value,
  onChange,
}: {
  value: string
  onChange: (next: string) => void
}) {
  const week = parseOpeningHours(value)
  const alwaysOpen = isAlwaysOpen(week)
  const uniform = isUniformOpen(week) && !alwaysOpen
  const [sameEveryDay, setSameEveryDay] = useState(uniform || alwaysOpen || !value.trim())

  const shared = useMemo(() => {
    const open = DAYS.map((day) => week[day.key]).find((slot) => slot.open)
    return open ?? { ...DEFAULT_SLOT, open: true }
  }, [week])

  function writeWeek(next: WeekHours) {
    onChange(serializeOpeningHours(next))
  }

  function setAlwaysOpen(on: boolean) {
    if (on) {
      const next = emptyWeek()
      for (const day of DAYS) next[day.key] = { ...ALL_DAY }
      setSameEveryDay(true)
      writeWeek(next)
      return
    }
    const next = emptyWeek()
    for (const day of DAYS) next[day.key] = { open: true, from: '08:00', to: '22:00' }
    setSameEveryDay(true)
    writeWeek(next)
  }

  function setSameHours(on: boolean) {
    setSameEveryDay(on)
    if (!on) return
    const sample = shared
    const next = emptyWeek()
    for (const day of DAYS) {
      next[day.key] = { open: true, from: sample.from === '00:00' && sample.to === '24:00' ? '08:00' : sample.from, to: sample.to === '24:00' ? '22:00' : sample.to }
    }
    writeWeek(next)
  }

  function patchShared(partial: Partial<DayHours>) {
    const base = { ...shared, ...partial, open: true }
    const next = emptyWeek()
    for (const day of DAYS) next[day.key] = { ...base }
    writeWeek(next)
  }

  function patch(day: DayKey, partial: Partial<DayHours>) {
    writeWeek({
      ...week,
      [day]: { ...week[day], ...partial },
    })
  }

  function clearAll() {
    setSameEveryDay(true)
    onChange('')
  }

  const showDayGrid = !alwaysOpen && !sameEveryDay
  const showSharedTimes = !alwaysOpen && sameEveryDay && Boolean(value.trim() || shared.open)

  return (
    <div className="space-y-3 rounded-[20px] border border-[#1a1a1a]/10 bg-white px-3 py-3">
      <ToggleRow
        checked={alwaysOpen}
        label="Open 24/7"
        hint="Courts are open every day, all day"
        onChange={setAlwaysOpen}
      />
      {!alwaysOpen && (
        <ToggleRow
          checked={sameEveryDay}
          label="Same hours every day"
          hint="Set one schedule, apply Mon–Sun"
          onChange={setSameHours}
        />
      )}

      {alwaysOpen && (
        <p className="font-copy text-[12px] text-[rgba(26,26,26,0.55)]">Saved as open every day, 00:00–24:00.</p>
      )}

      {showSharedTimes && (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          <input
            type="time"
            value={shared.from === '24:00' ? '00:00' : shared.from}
            onChange={(e) => patchShared({ from: e.target.value || '08:00' })}
            className={timeClass}
            aria-label="Opens"
          />
          <span className="text-[11px] text-[rgba(26,26,26,0.4)]">–</span>
          <input
            type="time"
            value={shared.to === '24:00' ? '23:59' : shared.to}
            onChange={(e) => patchShared({ to: e.target.value || '22:00' })}
            className={timeClass}
            aria-label="Closes"
          />
          {!value.trim() && (
            <button
              type="button"
              onClick={() => patchShared({})}
              className="text-[10px] tracking-[0.14em] uppercase font-medium text-brand-primary"
            >
              Use 08:00–22:00
            </button>
          )}
        </div>
      )}

      {showDayGrid && (
        <div className="space-y-2 pt-1">
          {DAYS.map((day) => {
            const slot = week[day.key]
            return (
              <div key={day.key} className="flex flex-wrap items-center gap-2">
                <span className="w-9 text-[10px] tracking-[0.14em] uppercase font-medium text-[rgba(26,26,26,0.55)]">
                  {day.label}
                </span>
                <button
                  type="button"
                  onClick={() => patch(day.key, { open: !slot.open, ...(slot.open ? {} : { from: '08:00', to: '22:00' }) })}
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
        </div>
      )}

      <button
        type="button"
        onClick={clearAll}
        className="text-[10px] tracking-[0.14em] uppercase font-medium text-[rgba(26,26,26,0.45)]"
      >
        Clear hours
      </button>
    </div>
  )
}
