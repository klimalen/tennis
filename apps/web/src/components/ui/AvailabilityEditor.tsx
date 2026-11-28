'use client'

import { useState } from 'react'
import { CalendarDays, Infinity as InfinityIcon, Moon, Repeat, Sun, Sunrise, X, type LucideIcon } from 'lucide-react'
import { formChoiceClass } from '@/components/ui/FormCard'
import {
  DAY_LABELS,
  DAY_ORDER,
  DAY_PARTS,
  PART_LABELS,
  anytimeAvailability,
  daysWithSlots,
  fillWeek,
  hasSlots,
  isAnytime,
  isUniformWeek,
  toggleDay,
  togglePart,
  toggleUniformPart,
  type Availability,
  type DayPart,
  selectedDays,
} from '@/lib/availability'

const PART_ICONS: Record<DayPart, LucideIcon> = {
  morning: Sunrise,
  afternoon: Sun,
  evening: Moon,
}

type ScheduleMode = 'anytime' | 'same' | 'byday'

const SCHEDULE_MODES: { value: ScheduleMode; label: string; hint: string; icon: LucideIcon }[] = [
  { value: 'anytime', label: 'Any time', hint: 'Free every day, morning to evening', icon: InfinityIcon },
  { value: 'same', label: 'Every day', hint: 'Pick times once for Mon–Sun', icon: Repeat },
  { value: 'byday', label: 'By day', hint: 'Pick days, then times for each', icon: CalendarDays },
]

function PartTiles({ isOn, onToggle, compact = false }: { isOn: (part: DayPart) => boolean; onToggle: (part: DayPart) => void; compact?: boolean }) {
  return (
    <div className="grid flex-1 grid-cols-3 gap-2">
      {DAY_PARTS.map((part) => {
        const Icon = PART_ICONS[part]
        const active = isOn(part)
        return (
          <button
            key={part}
            type="button"
            onClick={() => onToggle(part)}
            aria-pressed={active}
            className={`flex items-center justify-center gap-1.5 rounded-[16px] font-semibold ${
              compact ? 'h-9 text-[12px]' : 'h-[60px] flex-col text-[13px]'
            } ${formChoiceClass(active)}`}
          >
            <Icon size={compact ? 14 : 18} strokeWidth={1.7} className={active ? 'text-[#E8748A]' : 'text-[rgba(26,26,26,0.45)]'} aria-hidden />
            {compact ? PART_LABELS[part].slice(0, 3) : PART_LABELS[part]}
          </button>
        )
      })}
    </div>
  )
}

export function AvailabilityEditor({
  value,
  onChange,
  framed = true,
}: {
  value: Availability
  onChange: (next: Availability) => void
  /** Draw its own card. Off when a parent card already frames it. */
  framed?: boolean
}) {
  const anytime = isAnytime(value)
  const uniform = isUniformWeek(value) && !anytime
  const [sameEveryDay, setSameEveryDay] = useState(uniform || anytime || !hasSlots(value))

  const sharedParts = (() => {
    if (anytime) return [...DAY_PARTS]
    const day = daysWithSlots(value)[0]
    return day != null ? (value[day] ?? []) : []
  })()

  const mode: ScheduleMode = anytime ? 'anytime' : sameEveryDay ? 'same' : 'byday'

  function chooseMode(next: ScheduleMode) {
    if (next === mode) return
    if (next === 'anytime') {
      setSameEveryDay(true)
      onChange(anytimeAvailability())
      return
    }
    if (next === 'same') {
      setSameEveryDay(true)
      const parts = !anytime && sharedParts.length > 0 ? sharedParts : (['morning'] as DayPart[])
      onChange(fillWeek(parts))
      return
    }
    setSameEveryDay(false)
    if (anytime) onChange(fillWeek(['morning']))
  }

  function clearAll() {
    // Wipe every selection and leave the day grid empty — do not bounce
    // back into “Same times every day” (that looked like a failed clear).
    setSameEveryDay(false)
    onChange({})
  }

  const showSharedParts = !anytime && sameEveryDay
  const showDayGrid = !anytime && !sameEveryDay
  const openDays = selectedDays(value)
  const isCleared = !anytime && !hasSlots(value) && !sameEveryDay && openDays.length === 0

  return (
    <div className={`space-y-4 ${framed ? 'rounded-[20px] border border-[#1a1a1a]/10 bg-white px-3.5 py-3.5' : ''}`}>
      <div>
        <div className="grid grid-cols-3 gap-2" role="radiogroup" aria-label="When you play">
          {SCHEDULE_MODES.map((option) => {
            const active = mode === option.value
            const Icon = option.icon
            return (
              <button
                key={option.value}
                type="button"
                role="radio"
                aria-checked={active}
                onClick={() => chooseMode(option.value)}
                className={`flex flex-col items-center gap-1.5 rounded-[20px] px-1 py-3 text-[13px] font-semibold leading-tight ${formChoiceClass(active)}`}
              >
                <Icon size={19} strokeWidth={1.7} className={active ? 'text-[#E8748A]' : 'text-[rgba(26,26,26,0.45)]'} aria-hidden />
                {option.label}
              </button>
            )
          })}
        </div>
        <p className="mt-2.5 px-1 text-[12.5px] leading-snug text-[rgba(26,26,26,0.55)]" aria-live="polite">
          {SCHEDULE_MODES.find((option) => option.value === mode)?.hint}
        </p>
      </div>

      {showSharedParts && (
        <PartTiles isOn={(part) => sharedParts.includes(part)} onToggle={(part) => onChange(toggleUniformPart(value, part))} />
      )}

      {showDayGrid && (
        <div className="space-y-3">
          <div className="grid grid-cols-7 gap-1">
            {DAY_ORDER.map((day) => {
              const on = value[day] !== undefined
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onChange(toggleDay(value, day))}
                  aria-pressed={on}
                  className={`h-9 rounded-full text-[11px] font-semibold uppercase ${formChoiceClass(on)}`}
                >
                  {DAY_LABELS[day]?.slice(0, 2)}
                </button>
              )
            })}
          </div>

          {openDays.length > 0 && (
            <div className="space-y-2">
              {openDays.map((day) => (
                <div key={day} className="flex items-center gap-2.5">
                  <span className="w-9 flex-none text-[11px] font-semibold uppercase tracking-[0.12em] text-[rgba(26,26,26,0.55)]">
                    {DAY_LABELS[day]}
                  </span>
                  <PartTiles
                    compact
                    isOn={(part) => value[day]?.includes(part) ?? false}
                    onToggle={(part) => onChange(togglePart(value, day, part))}
                  />
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={clearAll}
        disabled={isCleared}
        className="inline-flex items-center gap-1.5 text-[11px] font-medium uppercase tracking-[0.14em] text-[rgba(26,26,26,0.55)] transition-colors hover:text-[#1a1a1a] disabled:pointer-events-none disabled:opacity-40"
      >
        <X size={12} aria-hidden />
        Clear schedule
      </button>
    </div>
  )
}
