const fieldClass =
  'block h-11 w-full min-w-0 max-w-full box-border appearance-none [-webkit-appearance:none] [-webkit-min-logical-width:0] px-2 border border-[#1a1a1a]/40 bg-brand-field rounded-full text-center text-sm leading-none text-[#1a1a1a] focus:outline-none focus:border-brand-primary transition-colors [&::-webkit-date-and-time-value]:m-0 [&::-webkit-date-and-time-value]:min-h-0 [&::-webkit-date-and-time-value]:p-0 [&::-webkit-date-and-time-value]:text-center [&::-webkit-datetime-edit]:p-0 [&::-webkit-datetime-edit-fields-wrapper]:p-0 [&::-webkit-calendar-picker-indicator]:hidden'

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
      <div className="grid grid-cols-[minmax(0,1.45fr)_minmax(0,1fr)_minmax(0,1fr)] gap-2">
        <div className="min-w-0">
          <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Date</label>
          <input
            type="date"
            value={date}
            min={minDate}
            onChange={(e) => onDate(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="min-w-0">
          <label className="block text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1.5">Starts</label>
          <input
            type="time"
            value={start}
            onChange={(e) => onStart(e.target.value)}
            required
            className={fieldClass}
          />
        </div>
        <div className="min-w-0">
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
