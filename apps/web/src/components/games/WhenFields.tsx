import type { ReactNode } from 'react'
import { CalendarDays, ChevronDown, Clock, Info } from 'lucide-react'
import { durationFromClock } from '@/lib/game-time'

/** White card that holds one form block. */
export const gameFormPanel = 'rounded-[28px] bg-white p-4'

/** Quiet inner field: time, search, amount. */
export const gameFormWell = 'rounded-[20px] bg-brand-surface'

/** Selectable tile inside a panel (access, cost, who pays). */
export function gameFormChoiceClass(selected: boolean) {
  return `border transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
    selected
      ? 'border-[#E8748A] bg-[#F8E6EA] text-[#1a1a1a]'
      : 'border-transparent bg-brand-surface text-[#1a1a1a] hover:border-[#1a1a1a]/15'
  }`
}

export function FormSectionLabel({ children, hint }: { children: ReactNode; hint?: string | undefined }) {
  return (
    <div className="mb-3 flex items-center gap-3">
      <span className="text-[10px] font-medium uppercase tracking-[0.22em] text-[rgba(26,26,26,0.5)]">
        {children}
        {hint && <span className="ml-1.5 normal-case tracking-normal text-[rgba(26,26,26,0.35)]">{hint}</span>}
      </span>
      <div className="h-px flex-1 bg-brand-divider" aria-hidden />
    </div>
  )
}

/** One muted line with an icon, for hints under a choice. */
export function FormNote({ children, icon = <Info size={15} strokeWidth={1.7} /> }: { children: ReactNode; icon?: ReactNode }) {
  return (
    <p className="flex items-start gap-2 text-[12.5px] leading-snug text-[rgba(26,26,26,0.55)]">
      <span className="mt-px flex-none text-[rgba(26,26,26,0.4)]" aria-hidden>{icon}</span>
      <span>{children}</span>
    </p>
  )
}

function openDatePicker(input: HTMLInputElement) {
  // Phones already open the system calendar on tap.
  if (window.matchMedia('(pointer: coarse)').matches) return
  if (typeof input.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // The calendar is already open.
  }
}

function durationText(minutes: number): string {
  const hours = Math.floor(minutes / 60)
  const rest = minutes % 60
  return [hours ? `${hours} hour${hours > 1 ? 's' : ''}` : '', rest ? `${rest} min` : ''].filter(Boolean).join(' ')
}

const timeInputClass =
  'block w-full min-w-0 appearance-none border-0 bg-transparent p-0 text-[22px] font-semibold leading-tight text-[#1a1a1a] focus:outline-none ' +
  '[&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:text-left [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 ' +
  '[&::-webkit-calendar-picker-indicator]:hidden'

function TimeTile({ label, value, onChange }: { label: string; value: string; onChange: (value: string) => void }) {
  return (
    <label className={`${gameFormWell} block cursor-text px-3.5 py-3 focus-within:ring-2 focus-within:ring-brand-primary/40`}>
      <span className="mb-1 block text-[10px] uppercase tracking-[0.2em] text-[rgba(26,26,26,0.5)]">{label}</span>
      <input type="time" value={value} onChange={(e) => onChange(e.target.value)} required className={timeInputClass} />
    </label>
  )
}

export function WhenFields({
  date,
  start,
  end,
  minDate,
  onDate,
  onStart,
  onEnd,
}: {
  date: string
  start: string
  end: string
  minDate?: string
  onDate: (value: string) => void
  onStart: (value: string) => void
  onEnd: (value: string) => void
}) {
  const day = date ? new Date(`${date}T12:00:00`) : null
  const valid = day && !Number.isNaN(day.getTime())
  const weekday = valid ? day.toLocaleDateString('en-US', { weekday: 'long' }) : 'Date'
  const dayMonth = valid ? day.toLocaleDateString('en-US', { month: 'long', day: 'numeric' }) : 'Pick a date'
  const minutes = date && start && end ? durationFromClock(date, start, end) : null
  const overnight = Boolean(start && end && end <= start)

  return (
    <section>
      <FormSectionLabel>When</FormSectionLabel>
      <div className={gameFormPanel}>
        <div className="relative flex items-center gap-3 rounded-[20px] focus-within:ring-2 focus-within:ring-brand-primary/40">
          <span className="grid h-12 w-12 flex-none place-items-center rounded-[16px] bg-brand-primary-muted text-brand-primary" aria-hidden>
            <CalendarDays size={22} strokeWidth={1.6} />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[10px] uppercase tracking-[0.2em] text-[rgba(26,26,26,0.5)]">
              {weekday}{valid ? ` · ${day.getFullYear()}` : ''}
            </span>
            <span className="mt-0.5 block truncate font-display text-[28px] uppercase leading-none tracking-wide text-[#1a1a1a]">{dayMonth}</span>
          </span>
          <ChevronDown size={20} strokeWidth={1.6} className="flex-none text-[rgba(26,26,26,0.4)]" aria-hidden />
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => onDate(e.target.value)}
            onClick={(e) => openDatePicker(e.currentTarget)}
            required
            aria-label="Game date"
            className="absolute inset-0 h-full w-full cursor-pointer appearance-none opacity-0 [&::-webkit-calendar-picker-indicator]:absolute [&::-webkit-calendar-picker-indicator]:inset-0 [&::-webkit-calendar-picker-indicator]:h-full [&::-webkit-calendar-picker-indicator]:w-full [&::-webkit-calendar-picker-indicator]:cursor-pointer"
          />
        </div>

        <div className="mt-4 grid grid-cols-2 gap-2.5 border-t border-[#EAE5DF] pt-4">
          <TimeTile label="Starts" value={start} onChange={onStart} />
          <TimeTile label="Ends" value={end} onChange={onEnd} />
        </div>

        {minutes != null && (
          <p className="mt-3 flex items-center justify-center gap-1.5 text-[12px] text-[rgba(26,26,26,0.5)]" aria-live="polite">
            <Clock size={13} strokeWidth={1.7} aria-hidden />
            {durationText(minutes)}{overnight ? ', ends the next day' : ''}
          </p>
        )}
      </div>
    </section>
  )
}
