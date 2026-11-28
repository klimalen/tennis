import type { ReactNode } from 'react'
import { Info } from 'lucide-react'

/** White card that holds one form block. */
export const formPanel = 'rounded-[28px] bg-white p-4'

/** Quiet inner field: time, search, amount, text. */
export const formWell = 'rounded-[20px] bg-brand-surface'

/** Selectable tile inside a panel. */
export function formChoiceClass(selected: boolean) {
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

/** Small caps label inside a card. */
export function FormEyebrow({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`block text-[10px] uppercase tracking-[0.2em] text-[rgba(26,26,26,0.5)] ${className}`}>{children}</span>
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

export function FormSwitch({ checked, onChange, label }: { checked: boolean; onChange: (next: boolean) => void; label: string }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      onClick={() => onChange(!checked)}
      className={`relative h-7 w-12 flex-none rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand-primary/50 ${
        checked ? 'bg-brand-primary' : 'bg-brand-field'
      }`}
    >
      <span
        className={`absolute top-1 h-5 w-5 rounded-full bg-white shadow-[0_1px_3px_rgba(26,26,26,0.2)] transition-[left] ${checked ? 'left-6' : 'left-1'}`}
        aria-hidden
      />
    </button>
  )
}
