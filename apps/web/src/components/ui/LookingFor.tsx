'use client'

import { ExpandableText } from '@/components/ui/ExpandableText'

export function LookingFor({ text, dense = false }: { text: string | null | undefined; dense?: boolean }) {
  const value = text?.trim()
  if (!value) return null
  return (
    <div className={dense ? 'mt-1 space-y-0.5' : 'mt-2 space-y-0.5'}>
      <p className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.45)]">Looking for</p>
      {dense ? (
        <p className="font-copy text-[11px] text-[rgba(26,26,26,0.55)] line-clamp-2 leading-relaxed">{value}</p>
      ) : (
        <ExpandableText text={value} className="font-copy text-sm text-[#497250] leading-snug" />
      )}
    </div>
  )
}
