export function ListSearch({
  value,
  onChange,
  placeholder,
}: {
  value: string
  onChange: (value: string) => void
  placeholder: string
}) {
  return (
    <input
      type="search"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      className="w-full bg-brand-field border border-[#1a1a1a]/40 rounded-lg px-4 py-2.5 text-sm text-[#1a1a1a] outline-none focus:border-brand-primary placeholder:text-[rgba(26,26,26,0.4)]"
    />
  )
}

export function MultiFilterChips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string[]
  onChange: (value: string[]) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto">
      {options.map((option) => {
        const active = value.includes(option.id)
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(active ? value.filter((id) => id !== option.id) : [...value, option.id])}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${
              active
                ? 'bg-[#1a1a1a] text-[#FAF7F2] border-[#1a1a1a]'
                : 'bg-brand-field border-[#1a1a1a]/15 text-[#1a1a1a]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}

export function FilterChips({
  options,
  value,
  onChange,
}: {
  options: { id: string; label: string }[]
  value: string | null
  onChange: (value: string | null) => void
}) {
  if (options.length === 0) return null
  return (
    <div className="flex gap-2 overflow-x-auto">
      {options.map((option) => {
        const active = value === option.id
        return (
          <button
            key={option.id}
            type="button"
            onClick={() => onChange(active ? null : option.id)}
            className={`flex-shrink-0 px-3 py-1.5 rounded-full text-[10px] tracking-[0.12em] uppercase font-medium border transition-colors ${
              active
                ? 'bg-[#1a1a1a] text-[#FAF7F2] border-[#1a1a1a]'
                : 'bg-brand-field border-[#1a1a1a]/15 text-[#1a1a1a]'
            }`}
          >
            {option.label}
          </button>
        )
      })}
    </div>
  )
}
