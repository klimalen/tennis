import { useEffect, useState } from 'react'
import { flushSync } from 'react-dom'
import { Check, Minus, Plus } from 'lucide-react'
import { FormSectionLabel, formPanel } from '@/components/ui/FormCard'
import { GROUP_SEAT_DEFAULT, GROUP_SEAT_MAX, GROUP_SEAT_MIN, type GameFormatChoice } from '@/lib/game-seats'

export const SINGLES_PLAYERS: [number, number][] = [[32, 25], [32, 61]]
export const DOUBLES_PLAYERS: [number, number][] = [[21, 25], [43, 25], [21, 61], [43, 61]]

const FORMAT_OPTIONS: { value: GameFormatChoice; label: string; detail: string; players: [number, number][] }[] = [
  {
    value: 'singles',
    label: 'Singles',
    detail: '2 players',
    players: SINGLES_PLAYERS,
  },
  {
    value: 'doubles',
    label: 'Doubles',
    detail: '4 players',
    players: DOUBLES_PLAYERS,
  },
  {
    value: 'group',
    label: 'Group',
    detail: 'Flexible',
    players: [[19, 16], [45, 16], [32, 30], [32, 56], [19, 70], [45, 70]],
  },
]

export function CourtDiagram({ players, selected }: { players: [number, number][]; selected: boolean }) {
  const surface = selected ? '#2d7066' : '#F0EBE3'
  const line = selected ? 'rgba(240,235,227,0.6)' : '#B9B2A8'
  const dot = selected ? '#BCD85E' : '#3A8A7A'
  return (
    <svg viewBox="0 0 64 86" className="h-[66px] w-12" aria-hidden="true">
      <rect x="8" y="3" width="48" height="80" rx="2" fill={surface} stroke={line} strokeWidth="1.4" />
      <path d="M15 3V83 M49 3V83 M8 43H56 M15 23H49 M15 63H49 M32 23V63" fill="none" stroke={line} strokeWidth="1.4" />
      {players.map(([x, y]) => (
        <circle key={`${x}-${y}`} cx={x} cy={y} r="4" fill={dot} />
      ))}
    </svg>
  )
}

export function FormatFields({
  format,
  maxPlayers,
  onFormat,
  onMaxPlayers,
  options = ['singles', 'doubles', 'group'],
}: {
  format: GameFormatChoice
  maxPlayers: number
  onFormat: (format: GameFormatChoice) => void
  onMaxPlayers: (seats: number) => void
  options?: GameFormatChoice[]
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

  function step(delta: number) {
    const seats = Math.min(GROUP_SEAT_MAX, Math.max(GROUP_SEAT_MIN, maxPlayers + delta))
    if (seats !== maxPlayers) onMaxPlayers(seats)
  }

  const shown = FORMAT_OPTIONS.filter((option) => options.includes(option.value))

  return (
    <section>
      <FormSectionLabel>Format</FormSectionLabel>
      <div className={`grid gap-2.5 ${shown.length === 2 ? 'grid-cols-2' : 'grid-cols-3'}`} role="group" aria-label="Game format">
        {shown.map((option) => {
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
              className={`relative flex min-w-0 flex-col items-center rounded-[20px] px-1.5 pb-3.5 pt-3 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
                selected ? 'bg-brand-primary text-[#F0EBE3]' : 'bg-white text-[#1a1a1a] hover:bg-white/70'
              }`}
            >
              <span
                className={`absolute right-2.5 top-2.5 grid h-[18px] w-[18px] place-items-center rounded-full border-[1.5px] ${
                  selected ? 'border-brand-conifer bg-brand-conifer text-brand-primary-dark' : 'border-[#1a1a1a]/15'
                }`}
                aria-hidden
              >
                {selected && <Check size={11} strokeWidth={3} />}
              </span>
              <CourtDiagram players={option.players} selected={selected} />
              <span className="mt-1.5 text-[15px] font-semibold leading-tight">{option.label}</span>
              <span className={`text-[12px] ${selected ? 'text-[#F0EBE3]/75' : 'text-[rgba(26,26,26,0.5)]'}`}>{option.detail}</span>
            </button>
          )
        })}
      </div>

      {format === 'group' && (
        <div className={`${formPanel} mt-2.5 flex items-center justify-between gap-3 py-3`}>
          <label htmlFor="group-max-players" className="min-w-0">
            <span className="block text-[14px] font-semibold text-[#1a1a1a]">Max players</span>
            <span className="block text-[12px] text-[rgba(26,26,26,0.5)]">Any number can join, up to {GROUP_SEAT_MAX}</span>
          </label>
          <div className="flex flex-none items-center gap-1.5">
            <button
              type="button"
              onClick={() => step(-1)}
              disabled={maxPlayers <= GROUP_SEAT_MIN}
              aria-label="Fewer players"
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-surface text-[#1a1a1a] transition-colors hover:bg-brand-field disabled:opacity-40"
            >
              <Minus size={16} />
            </button>
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
              className="w-10 bg-transparent text-center font-numbers text-[22px] leading-none text-[#1a1a1a] focus:outline-none"
            />
            <button
              type="button"
              onClick={() => step(1)}
              disabled={maxPlayers >= GROUP_SEAT_MAX}
              aria-label="More players"
              className="grid h-9 w-9 place-items-center rounded-full bg-brand-surface text-[#1a1a1a] transition-colors hover:bg-brand-field disabled:opacity-40"
            >
              <Plus size={16} />
            </button>
          </div>
        </div>
      )}
    </section>
  )
}
