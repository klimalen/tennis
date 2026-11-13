'use client'

import { ArrowDown, ArrowRight } from 'lucide-react'
import { formatGameTicketTime } from '@/components/ui/LocalGameTime'
import { formatCourtCost } from '@/lib/game-court'

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
}

export type OpenGameTicketFace = {
  id: string
  name: string
  avatarUrl: string | null
}

export type OpenGameTicketBeard = 'join' | 'in' | 'full' | null

function ticketInitials(name: string) {
  return name.split(' ').map((word) => word[0] ?? '').join('').slice(0, 2).toUpperCase()
}

function TicketFaces({ people, spotsLeft }: { people: OpenGameTicketFace[]; spotsLeft: number }) {
  const shown = people.slice(0, 4)
  const extra = people.length - shown.length
  return (
    <span className="flex items-start gap-2 @[540px]:gap-3">
      {shown.map((person) => (
        <span key={person.id} className="flex w-8 flex-col items-center @[540px]:w-11">
          <span className="flex h-8 w-8 items-center justify-center overflow-hidden rounded-full bg-[#F0EBE3]/20 @[540px]:h-10 @[540px]:w-10">
            {person.avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={person.avatarUrl} alt="" className="h-full w-full object-cover" />
            ) : (
              <span className="font-display text-xs text-[#F0EBE3] @[540px]:text-sm">{ticketInitials(person.name)}</span>
            )}
          </span>
          <span className="mt-1 max-w-[36px] truncate text-[10px] text-[#F0EBE3]/80 @[540px]:max-w-[48px]">{person.name.split(' ')[0]}</span>
        </span>
      ))}
      {extra > 0 && (
        <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[#F0EBE3]/15 text-[11px] text-[#F0EBE3] @[540px]:h-10 @[540px]:w-10">+{extra}</span>
      )}
      {Array.from({ length: Math.max(0, spotsLeft) }, (_, index) => (
        <span key={`open-${index}`} className="flex w-8 flex-col items-center @[540px]:w-11">
          <span className="flex h-8 w-8 items-center justify-center rounded-full border border-dashed border-[#F0EBE3]/70 text-base leading-none text-[#F0EBE3] @[540px]:h-10 @[540px]:w-10 @[540px]:text-lg">+</span>
          <span className="mt-1 text-[10px] text-[#F0EBE3]/80">Open</span>
        </span>
      ))}
    </span>
  )
}

function CourtArt() {
  return (
    <div
      aria-hidden
      className="pointer-events-none absolute -bottom-11 -right-9 h-[8.25rem] w-[10rem] -rotate-[7deg] border-[4px] border-[#F0EBE3]/80 @[540px]:-bottom-[4.75rem] @[540px]:-right-16 @[540px]:h-[17rem] @[540px]:w-[27rem] @[540px]:border-[5px]"
    >
      <div className="absolute inset-y-0 left-1/2 w-[4px] -translate-x-1/2 bg-[#F0EBE3]/80 @[540px]:w-[5px]" />
      <div className="absolute inset-x-0 top-1/2 h-[4px] -translate-y-1/2 bg-[#F0EBE3]/80 @[540px]:h-[5px]" />
    </div>
  )
}

/** Shared “ticket” visual from Discover → Games. Chat cards stay separate. */
export function OpenGameTicketCard({
  title,
  format,
  scheduledAt,
  durationMinutes = null,
  courtCostCents = null,
  courtFee,
  faces,
  spotsLeft,
  isFull,
  beard,
  onOpen,
  onJoin,
  muted = false,
  badge,
}: {
  title: string
  format: string
  scheduledAt: string
  durationMinutes?: number | null
  courtCostCents?: number | null
  /** When false, treat as free even if cents are set. */
  courtFee?: boolean | null
  faces: OpenGameTicketFace[]
  spotsLeft: number
  isFull: boolean
  beard: OpenGameTicketBeard
  onOpen: () => void
  onJoin?: () => void
  /** Cancelled / past — keep layout, mute interaction strip. */
  muted?: boolean
  badge?: string | null
}) {
  const formatLabel = FORMAT_LABELS[format] ?? format
  const amount = courtFee === false ? 'Free' : formatCourtCost(courtCostCents)
  const priceLabel = amount === 'Free' || courtCostCents === 0
    ? 'Free'
    : amount
      ? `${amount} total`
      : null
  const meta = [formatLabel, priceLabel].filter(Boolean).join(' · ')
  const { dateLabel, startLabel, endLabel } = formatGameTicketTime(scheduledAt, durationMinutes)

  const spotsPill = isFull
    ? 'bg-[#E8748A] text-[#1a1a1a]'
    : 'bg-[#BCD85E] text-[#1a1a1a]'

  const effectiveBeard: OpenGameTicketBeard = muted ? null : beard
  const beardBg = effectiveBeard === 'join'
    ? 'bg-[#BCD85E]'
    : effectiveBeard === 'full'
      ? 'bg-[#163A32]'
      : effectiveBeard === 'in'
        ? 'bg-[#1E3A6E]'
        : undefined

  return (
    <div className={effectiveBeard ? `overflow-hidden rounded-[28px] ${beardBg}` : undefined}>
      <div className={`@container relative overflow-hidden rounded-[28px] bg-[#3A8A7A] text-[#F0EBE3] ${muted ? 'opacity-70' : ''}`}>
        <CourtArt />
        <span className={`pointer-events-none absolute right-3 top-3 z-10 rounded-full px-2.5 py-1 text-[10px] font-medium uppercase tracking-[0.12em] ${badge ? 'bg-[#E8748A] text-[#1a1a1a]' : spotsPill}`}>
          {badge ?? (isFull ? 'Full' : `${spotsLeft} left`)}
        </span>
        <button type="button" onClick={onOpen} className="relative flex w-full items-stretch text-left">
          <span className="flex w-[4.25rem] flex-shrink-0 flex-col items-center justify-center gap-0.5 bg-[#2C6A5C] py-4 @[540px]:w-[4.75rem]">
            <span className="text-[9px] font-medium uppercase tracking-[0.14em] text-[#F0EBE3]/70">{dateLabel}</span>
            <span className="font-display text-lg leading-none tracking-wide @[540px]:text-xl">{startLabel}</span>
            <ArrowDown size={14} strokeWidth={1.75} className="my-0.5 text-[#F0EBE3]/80" />
            <span className="font-display text-lg leading-none tracking-wide @[540px]:text-xl">{endLabel}</span>
          </span>
          <span className="relative w-px flex-shrink-0 self-stretch" aria-hidden>
            <span className="absolute inset-y-3 left-0 border-l border-dashed border-[#F0EBE3]/45" />
          </span>
          <span className="relative z-[1] flex min-w-0 flex-1 flex-col overflow-hidden py-3.5 pl-3 pr-16">
            <span className="line-clamp-2 break-words font-display text-2xl leading-[1.05] tracking-wide uppercase @[540px]:text-3xl">{title}</span>
            <span className="mt-1.5 truncate text-[13px] text-[#F0EBE3]/80">{meta}</span>
            <span className="mt-3">
              <TicketFaces people={faces} spotsLeft={Math.max(0, spotsLeft)} />
            </span>
          </span>
        </button>
      </div>
      {effectiveBeard === 'join' && (
        <button
          type="button"
          onClick={(event) => {
            event.stopPropagation()
            onJoin?.()
          }}
          className="flex w-full items-center justify-center gap-2 py-3 text-[12px] font-medium uppercase tracking-[0.16em] text-[#1a1a1a] hover:bg-[#A8C44A]"
        >
          Join
          <ArrowRight size={16} strokeWidth={1.75} />
        </button>
      )}
      {effectiveBeard === 'in' && (
        <div className="flex w-full items-center justify-center py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#F0EBE3]">
          You&apos;re in
        </div>
      )}
      {effectiveBeard === 'full' && (
        <div className="flex w-full items-center justify-center py-3 text-[11px] font-medium uppercase tracking-[0.16em] text-[#F0EBE3]/75">
          Full
        </div>
      )}
    </div>
  )
}
