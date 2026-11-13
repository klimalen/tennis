/** Shared pill size for date/time + option chips on create/edit game forms. */
export const gameFormPill =
  'h-11 min-h-11 max-h-11 box-border rounded-full border border-[#1a1a1a]/40 bg-brand-field text-base leading-none text-[#1a1a1a] transition-colors'

const fieldClass =
  `${gameFormPill} flex w-full min-w-0 max-w-full items-center justify-center appearance-none [-webkit-appearance:none] [-webkit-min-logical-width:0] overflow-hidden px-3 text-center focus:outline-none focus:border-brand-primary ` +
  '[&::-webkit-date-and-time-value]:m-auto [&::-webkit-date-and-time-value]:h-auto [&::-webkit-date-and-time-value]:min-h-0 [&::-webkit-date-and-time-value]:w-full [&::-webkit-date-and-time-value]:text-center [&::-webkit-date-and-time-value]:text-base [&::-webkit-date-and-time-value]:leading-none ' +
  '[&::-webkit-datetime-edit]:m-auto [&::-webkit-datetime-edit]:w-full [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:text-center [&::-webkit-datetime-edit]:text-base [&::-webkit-datetime-edit]:leading-none ' +
  '[&::-webkit-datetime-edit-fields-wrapper]:m-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:text-base [&::-webkit-datetime-edit-fields-wrapper]:leading-none ' +
  '[&::-webkit-datetime-edit-text]:p-0 [&::-webkit-datetime-edit-hour-field]:p-0 [&::-webkit-datetime-edit-minute-field]:p-0 [&::-webkit-datetime-edit-day-field]:p-0 [&::-webkit-datetime-edit-month-field]:p-0 [&::-webkit-datetime-edit-year-field]:p-0 ' +
  '[&::-webkit-calendar-picker-indicator]:hidden'

/** Option chips (Format / Visibility) — same height & type size as date/time. */
export const gameFormOptionPill =
  `${gameFormPill} flex flex-1 items-center justify-center px-3 text-center font-medium tracking-[0.08em] focus:outline-none`

function openDatePicker(input: HTMLInputElement) {
  // Phones already open the system calendar on tap. Desktop Chrome only opens it
  // from the icon, which is hidden so the date stays centered.
  if (window.matchMedia('(pointer: coarse)').matches) return
  if (typeof input.showPicker !== 'function') return
  try {
    input.showPicker()
  } catch {
    // The calendar is already open.
  }
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
  return (
    <div>
      <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium mb-3">When</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="col-span-2 min-w-0 overflow-hidden sm:col-span-1">
          <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => onDate(e.target.value)}
            onClick={(e) => openDatePicker(e.currentTarget)}
            required
            className={`${fieldClass} cursor-pointer`}
          />
        </div>
        <div className="min-w-0 overflow-hidden">
          <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Starts</label>
          <input
            type="time"
            value={start}
            onChange={(e) => onStart(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="min-w-0 overflow-hidden">
          <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Ends</label>
          <input
            type="time"
            value={end}
            onChange={(e) => onEnd(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
      </div>
    </div>
  )
}
