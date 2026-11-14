import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { FormSectionLabel, gameFormOptionPill, gameFormPill } from '@/components/games/WhenFields'
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
  const [draft, setDraft] = useState(String(maxPlayers))
  useEffect(() => { setDraft(String(maxPlayers)) }, [maxPlayers])

  function commit(raw: string) {
    const digits = raw.replace(/\D/g, '')
    if (!digits) {
      setDraft(String(maxPlayers))
      return
    }
    const seats = Math.min(GROUP_SEAT_MAX, Math.max(GROUP_SEAT_MIN, Number(digits)))
    setDraft(String(seats))
    if (seats !== maxPlayers) flushSync(() => onMaxPlayers(seats))
  }

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
          <label htmlFor="group-max-players" className="text-[12px] text-[rgba(26,26,26,0.55)]">
            Maximum players. The game stays open with any number of people, up to this many.
          </label>
          <div className="mt-2 flex items-center gap-3">
            <input
              id="group-max-players"
              inputMode="numeric"
              autoComplete="off"
              value={draft}
              onChange={(event) => {
                const digits = event.target.value.replace(/\D/g, '').slice(0, 2)
                setDraft(digits)
                const seats = Number(digits)
                if (digits && seats >= GROUP_SEAT_MIN && seats <= GROUP_SEAT_MAX && seats !== maxPlayers) {
                  onMaxPlayers(seats)
                }
              }}
              onBlur={() => commit(draft)}
              onKeyDown={(event) => {
                if (event.key === 'Enter') {
                  event.preventDefault()
                  commit(draft)
                }
              }}
              aria-describedby="group-max-players-hint"
              className={`${gameFormPill} w-20 px-3 text-center text-[15px] focus:outline-none focus:border-brand-primary`}
            />
            <p id="group-max-players-hint" className="text-[12px] text-[rgba(26,26,26,0.45)]">
              No more than {GROUP_SEAT_MAX} players.
            </p>
          </div>
        </div>
      )}
    </div>
  )
}
