import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { FormSectionLabel, gameFormPill } from '@/components/games/WhenFields'
import { GROUP_SEAT_DEFAULT, GROUP_SEAT_MAX, GROUP_SEAT_MIN, type GameFormatChoice } from '@/lib/game-seats'

const FORMAT_OPTIONS: { value: GameFormatChoice; label: string; detail: string; players: [number, number][] }[] = [
  {
    value: 'singles',
    label: 'Singles',
    detail: '2 players',
    players: [[32, 24], [32, 64]],
  },
  {
    value: 'doubles',
    label: 'Doubles',
    detail: '4 players',
    players: [[20, 24], [44, 24], [20, 64], [44, 64]],
  },
  {
    value: 'group',
    label: 'Group',
    detail: 'Flexible',
    players: [[16, 18], [32, 26], [48, 18], [16, 70], [32, 62], [48, 70]],
  },
]

function CourtDiagram({
  players,
  selected,
}: {
  players: [number, number][]
  selected: boolean
}) {
  const line = selected ? 'rgba(26,26,26,0.55)' : 'rgba(26,26,26,0.4)'
  const surface = selected ? '#F8E6EA' : '#EFE8DF'
  const dot = selected ? '#E8748A' : 'rgba(26,26,26,0.45)'
  return (
    <svg viewBox="0 0 64 88" className="h-16 w-12" aria-hidden="true">
      <rect x="6" y="4" width="52" height="80" rx="3" fill={surface} stroke={line} strokeWidth="1.6" />
      <rect x="14" y="4" width="36" height="80" fill="none" stroke={line} strokeWidth="1" />
      <line x1="14" y1="22" x2="50" y2="22" stroke={line} strokeWidth="1" />
      <line x1="14" y1="66" x2="50" y2="66" stroke={line} strokeWidth="1" />
      <line x1="32" y1="22" x2="32" y2="66" stroke={line} strokeWidth="1" />
      <line x1="6" y1="44" x2="58" y2="44" stroke={line} strokeWidth="2" />
      {players.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="3.2" fill={dot} />
      ))}
    </svg>
  )
}

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
      <div className="grid grid-cols-3 gap-2">
        {FORMAT_OPTIONS.map((option) => {
          const selected = format === option.value
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => {
                onFormat(option.value)
                if (option.value === 'group' && (maxPlayers < GROUP_SEAT_MIN || maxPlayers > GROUP_SEAT_MAX)) {
                  onMaxPlayers(GROUP_SEAT_DEFAULT)
                }
              }}
              className={`flex flex-col items-center rounded-2xl border px-2 py-3 transition-colors ${
                selected ? 'border-[#E8748A] bg-[#F8E6EA]' : 'border-[#1a1a1a]/15 bg-brand-field'
              }`}
            >
              <CourtDiagram players={option.players} selected={selected} />
              <span className="mt-2 text-[13px] font-medium text-[#1a1a1a]">{option.label}</span>
              <span className="text-[11px] text-[rgba(26,26,26,0.5)]">{option.detail}</span>
            </button>
          )
        })}
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
