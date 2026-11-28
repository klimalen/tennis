'use client'

import Image from 'next/image'
import Link from 'next/link'
import { CalendarDays, ChevronRight } from 'lucide-react'
import { recapPlayerNames, type RecapPlayer } from '@/lib/game-recap'
import { formatRecapDate } from '@/components/ui/LocalGameTime'

export function GameRecapCard({
  gameId,
  scheduledAt,
  players,
  canOpen,
}: {
  gameId: string
  scheduledAt: string | null
  players: RecapPlayer[]
  canOpen: boolean
}) {
  const names = recapPlayerNames(players)
  const body = (
    <>
      <div className="flex items-center gap-2">
        <CalendarDays size={14} className="flex-shrink-0 text-[rgba(26,26,26,0.45)]" />
        <span className="text-[11px] font-medium text-[#1a1a1a]">Game recap</span>
        <span className="ml-auto text-[11px] text-[rgba(26,26,26,0.45)]">
          {scheduledAt ? formatRecapDate(scheduledAt, 'short') : ''}
        </span>
        {canOpen && <ChevronRight size={14} className="flex-shrink-0 text-[rgba(26,26,26,0.35)]" />}
      </div>
      <div className="my-2.5 h-px bg-[#1a1a1a]/10" />
      <div className="flex items-center gap-2.5">
        <div className="flex -space-x-2">
          {players.slice(0, 3).map((player) => (
            <div key={player.id} className="h-8 w-8 overflow-hidden rounded-full border-2 border-white bg-brand-avatar">
              {player.avatar_url ? (
                <Image src={player.avatar_url} alt="" width={32} height={32} className="h-full w-full object-cover" />
              ) : (
                <span className="flex h-full w-full items-center justify-center font-display text-[11px] text-[#1a1a1a]">
                  {(player.full_name[0] ?? '?').toUpperCase()}
                </span>
              )}
            </div>
          ))}
        </div>
        <div className="min-w-0">
          <p className="truncate text-[13px] font-medium text-[#1a1a1a]">{names}</p>
          <p className="text-[11px] text-[rgba(26,26,26,0.45)]">Played together</p>
        </div>
      </div>
    </>
  )

  const className = 'mt-3 block rounded-2xl border border-[#1a1a1a]/10 px-3.5 py-3'

  if (!canOpen) return <div className={className}>{body}</div>

  return (
    <Link href={`/game/${gameId}`} className={`${className} transition-colors hover:border-[#1a1a1a]/25`}>
      {body}
    </Link>
  )
}
