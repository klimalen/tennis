import { FormSectionLabel, gameFormOptionPill } from '@/components/games/WhenFields'
import { GROUP_SEAT_DEFAULT, GROUP_SEAT_MAX, GROUP_SEAT_MIN, type GameFormatChoice } from '@/lib/game-seats'

const FORMAT_OPTIONS: { value: GameFormatChoice; label: string }[] = [
  { value: 'singles', label: 'Singles' },
  { value: 'doubles', label: 'Doubles' },
  { value: 'group', label: 'Group' },
]

export function FormatFields({
  format,
  maxPlayers,
  onFormat,
  onMaxPlayers,
}: {
  format: GameFormatChoice
  maxPlayers: number
  onFormat: (format: GameFormatChoice) => void
  onMaxPlayers: (seats: number) => void
}) {
  return (
    <div>
      <FormSectionLabel>Format</FormSectionLabel>
      <div className="flex gap-2">
        {FORMAT_OPTIONS.map((option) => (
          <button
            key={option.value}
            type="button"
            onClick={() => {
              onFormat(option.value)
              if (option.value === 'group' && (maxPlayers < GROUP_SEAT_MIN || maxPlayers > GROUP_SEAT_MAX)) {
                onMaxPlayers(GROUP_SEAT_DEFAULT)
              }
            }}
            className={`${gameFormOptionPill} ${
              format === option.value ? 'border-[#E8748A] bg-[#E8748A]' : 'hover:border-[#1a1a1a]/60'
            }`}
          >
            {option.label}
          </button>
        ))}
      </div>
      {format === 'group' && (
        <div className="mt-3">
          <p className="text-[12px] text-[rgba(26,26,26,0.55)]">
            Maximum players. The game stays open with any number of people, up to this many.
          </p>
          <div className="mt-2 flex items-center gap-3">
            <button
              type="button"
              aria-label="Fewer players"
              disabled={maxPlayers <= GROUP_SEAT_MIN}
              onClick={() => onMaxPlayers(Math.max(GROUP_SEAT_MIN, maxPlayers - 1))}
              className="flex size-11 items-center justify-center rounded-full border border-[#1a1a1a]/40 bg-brand-field text-lg text-[#1a1a1a] disabled:opacity-30"
            >
              −
            </button>
            <span className="min-w-8 text-center font-display text-2xl tracking-wide text-[#1a1a1a]">{maxPlayers}</span>
            <button
              type="button"
              aria-label="More players"
              disabled={maxPlayers >= GROUP_SEAT_MAX}
              onClick={() => onMaxPlayers(Math.min(GROUP_SEAT_MAX, maxPlayers + 1))}
              className="flex size-11 items-center justify-center rounded-full border border-[#1a1a1a]/40 bg-brand-field text-lg text-[#1a1a1a] disabled:opacity-30"
            >
              +
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
