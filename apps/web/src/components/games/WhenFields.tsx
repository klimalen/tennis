const fieldClass =
  'flex h-11 w-full min-w-0 max-w-full items-center justify-center box-border appearance-none [-webkit-appearance:none] [-webkit-min-logical-width:0] overflow-hidden px-3 border border-[#1a1a1a]/40 bg-brand-field rounded-full text-center text-sm text-[#1a1a1a] focus:outline-none focus:border-brand-primary transition-colors [&::-webkit-date-and-time-value]:m-auto [&::-webkit-date-and-time-value]:h-auto [&::-webkit-date-and-time-value]:min-h-[1.25em] [&::-webkit-date-and-time-value]:w-full [&::-webkit-date-and-time-value]:text-center [&::-webkit-datetime-edit]:m-auto [&::-webkit-datetime-edit]:w-full [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit]:text-center [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-calendar-picker-indicator]:hidden'

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
