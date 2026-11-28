'use client'

import { Globe, Lock, Users, type LucideIcon } from 'lucide-react'
import { FormNote, FormSectionLabel, gameFormChoiceClass, gameFormPanel } from '@/components/games/WhenFields'
import { VISIBILITY_OPTIONS, type GameVisibility } from '@/lib/game-visibility'

const ICONS: Record<GameVisibility, LucideIcon> = {
  private: Lock,
  friends: Users,
  open: Globe,
}

export function VisibilityFields({
  value,
  onChange,
  notePrivateChange = false,
}: {
  value: GameVisibility
  onChange: (value: GameVisibility) => void
  notePrivateChange?: boolean
}) {
  const current = VISIBILITY_OPTIONS.find((option) => option.value === value)
  return (
    <section>
      <FormSectionLabel>Who can join</FormSectionLabel>
      <div className={`${gameFormPanel} p-2`}>
        <div className="grid grid-cols-3 gap-2" role="group" aria-label="Who can join">
          {VISIBILITY_OPTIONS.map((option) => {
            const selected = value === option.value
            const Icon = ICONS[option.value]
            return (
              <button
                key={option.value}
                type="button"
                onClick={() => onChange(option.value)}
                aria-pressed={selected}
                className={`flex flex-col items-center gap-2 rounded-[20px] px-1 py-3.5 text-[14px] font-semibold ${gameFormChoiceClass(selected)}`}
              >
                <Icon size={21} strokeWidth={1.7} className={selected ? 'text-[#E8748A]' : 'text-[rgba(26,26,26,0.45)]'} aria-hidden />
                {option.title}
              </button>
            )
          })}
        </div>
        <div className="space-y-1.5 px-2 pb-2 pt-3" aria-live="polite">
          {current && <FormNote>{current.join}</FormNote>}
          {notePrivateChange && value === 'private' && (
            <p className="pl-[23px] text-[12px] leading-snug text-[rgba(26,26,26,0.45)]">
              People already in the game stay. It leaves Search and the feed.
            </p>
          )}
        </div>
      </div>
    </section>
  )
}
