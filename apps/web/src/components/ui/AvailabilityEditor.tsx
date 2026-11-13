'use client'

import { useState } from 'react'
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

function PartPill({ part, active, onClick }: { part: DayPart; active: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1.5 text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${
        active
          ? 'rounded-full bg-[#E8748A] text-[#1a1a1a] border-[#E8748A]'
          : 'rounded-full bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
      }`}
    >
      {PART_LABELS[part]}
    </button>
  )
}

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: Availability
  onChange: (next: Availability) => void
}) {
  const anytime = isAnytime(value)
  const uniform = isUniformWeek(value) && !anytime
  const [sameEveryDay, setSameEveryDay] = useState(uniform || anytime || !hasSlots(value))

  const sharedParts = (() => {
    if (anytime) return [...DAY_PARTS]
    const day = daysWithSlots(value)[0]
    return day != null ? (value[day] ?? []) : []
  })()

  function setAnytime(on: boolean) {
    if (on) {
      setSameEveryDay(true)
      onChange(anytimeAvailability())
      return
    }
    setSameEveryDay(true)
    onChange(fillWeek(['morning']))
  }

  function setSameTimes(on: boolean) {
    setSameEveryDay(on)
    if (!on) return
    const parts = sharedParts.length > 0 ? sharedParts : (['morning'] as DayPart[])
    onChange(fillWeek(parts))
  }

  function clearAll() {
    setSameEveryDay(true)
    onChange({})
  }

  const showSharedParts = !anytime && sameEveryDay
  const showDayGrid = !anytime && !sameEveryDay
  const openDays = selectedDays(value)

  return (
    <div className="space-y-3 rounded-[20px] border border-[#1a1a1a]/10 bg-white px-3 py-3">
      <ToggleRow
        checked={anytime}
        label="Any day, any time"
        hint="Free whenever — mornings, afternoons, and evenings"
        onChange={setAnytime}
      />
      {!anytime && (
        <ToggleRow
          checked={sameEveryDay}
          label="Same times every day"
          hint="Pick day-parts once, apply Mon–Sun"
          onChange={setSameTimes}
        />
      )}

      {anytime && (
        <p className="font-copy text-[12px] text-[rgba(26,26,26,0.55)]">
          Saved as available every day, morning–evening.
        </p>
      )}

      {showSharedParts && (
        <div className="flex flex-wrap items-center gap-2 pl-7">
          {DAY_PARTS.map((part) => (
            <PartPill
              key={part}
              part={part}
              active={sharedParts.includes(part)}
              onClick={() => onChange(toggleUniformPart(value, part))}
            />
          ))}
        </div>
      )}

      {showDayGrid && (
        <div>
          <div className="flex gap-3 flex-wrap">
            {DAY_ORDER.map((day) => {
              const on = value[day] !== undefined
              return (
                <button
                  key={day}
                  type="button"
                  onClick={() => onChange(toggleDay(value, day))}
                  className={`w-10 h-10 text-[10px] tracking-wider uppercase font-medium border transition-colors ${
                    on
                      ? 'rounded-full bg-[#E8748A] text-[#1a1a1a] border-[#E8748A]'
                      : 'rounded-full bg-brand-field text-[#1a1a1a] border-[#1a1a1a]/40 hover:border-[#1a1a1a]/60'
                  }`}
                >
                  {DAY_LABELS[day]}
                </button>
              )
            })}
          </div>

          {openDays.length > 0 && (
            <div className="mt-4 space-y-2.5">
              {openDays.map((day) => (
                <div key={day} className="flex flex-wrap items-center gap-2">
                  <span className="w-9 text-[10px] tracking-[0.14em] uppercase font-medium text-[rgba(26,26,26,0.55)]">
                    {DAY_LABELS[day]}
                  </span>
                  {DAY_PARTS.map((part) => (
                    <PartPill
                      key={part}
                      part={part}
                      active={value[day]?.includes(part) ?? false}
                      onClick={() => onChange(togglePart(value, day, part))}
                    />
                  ))}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      <button
        type="button"
        onClick={clearAll}
        className="text-[10px] tracking-[0.14em] uppercase font-medium text-[rgba(26,26,26,0.45)]"
      >
        Clear schedule
      </button>
    </div>
  )
}
