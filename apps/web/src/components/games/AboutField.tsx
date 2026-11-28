import { FormSectionLabel } from '@/components/games/WhenFields'

export function AboutField({ value, onChange }: { value: string; onChange: (value: string) => void }) {
  return (
    <section>
      <FormSectionLabel hint="(optional)">About</FormSectionLabel>
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="Anything players should know?"
        aria-label="About the game"
        rows={3}
        maxLength={500}
        className="font-copy block min-h-[96px] w-full resize-none rounded-[28px] border-0 bg-white px-4 py-3.5 text-[14px] text-[#1a1a1a] placeholder:text-[rgba(26,26,26,0.35)] focus:outline-none focus:ring-2 focus:ring-brand-primary/40"
      />
    </section>
  )
}
