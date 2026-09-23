'use client'

import {
  DAY_LABELS,
  DAY_ORDER,
  DAY_PARTS,
  PART_LABELS,
  type Availability,
  type DayPart,
  selectedDays,
  toggleDay,
  togglePart,
} from '@/lib/availability'

export function AvailabilityEditor({
  value,
  onChange,
}: {
  value: Availability
  onChange: (next: Availability) => void
}) {
  const openDays = selectedDays(value)

  return (
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
