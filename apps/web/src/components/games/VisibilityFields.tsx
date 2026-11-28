'use client'

import { FormSectionLabel } from '@/components/games/WhenFields'
import { VISIBILITY_OPTIONS, type GameVisibility } from '@/lib/game-visibility'

export function VisibilityFields({
  value,
  onChange,
  notePrivateChange = false,
}: {
  value: GameVisibility
  onChange: (value: GameVisibility) => void
  notePrivateChange?: boolean
}) {
  return (
    <div>
      <FormSectionLabel>Who can join</FormSectionLabel>
      <div className="space-y-2">
        {VISIBILITY_OPTIONS.map((option) => {
          const selected = value === option.value
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => onChange(option.value)}
              aria-pressed={selected}
              className={`w-full rounded-2xl border px-3.5 py-3 text-left transition-colors ${
                selected ? 'border-[#E8748A] bg-[#F8E6EA]' : 'border-[#1a1a1a]/15 bg-brand-field'
              }`}
            >
              <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a]">{option.title}</p>
              <p className="mt-1.5 text-[12px] leading-snug text-[rgba(26,26,26,0.62)]">
                {option.join} {option.seen}
              </p>
            </button>
          )
        })}
      </div>
      {notePrivateChange && value === 'private' && (
        <p className="mt-2 text-[11px] leading-snug text-[rgba(26,26,26,0.55)]">
          People already in the game stay in it. It leaves Search and the feed.
        </p>
      )}
    </div>
  )
}
