'use client'

import { useState, type ReactNode } from 'react'
import Link from 'next/link'
import { Pencil } from 'lucide-react'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'
import { gameEndMs } from '@/lib/game-time'
import { formatPlayFormat } from '@/lib/skill'
import { GameDetailSheet, loadGameDetail, viewerCanOpenGame, type GameDetail } from '@/components/games/GameDetailSheet'
import type { ScheduleGame, SchedulePreviewItem } from '@/lib/schedule'

export function ScheduleGameCard({
  game,
  past,
  editHref,
  viewerId = null,
}: {
  game: ScheduleGame
  past: boolean
  editHref?: string | null
  viewerId?: string | null
}) {
  const [detail, setDetail] = useState<GameDetail | null>(null)
  const endIso = new Date(gameEndMs(game.scheduled_at, game.duration_minutes)).toISOString()
  const canTry = game.is_open || Boolean(viewerId)

  async function open() {
    const loaded = await loadGameDetail(game.id)
    if (!loaded || !viewerCanOpenGame(loaded, viewerId)) return
    setDetail(loaded)
  }

  return (
    <>
    <div
      className={`mb-3 px-4 py-4 rounded-[28px] bg-white flex items-center gap-4 ${past ? 'opacity-75' : ''} ${canTry ? 'cursor-pointer' : ''}`}
      onClick={canTry ? () => { void open() } : undefined}
      onKeyDown={canTry ? (event) => { if (event.key === 'Enter') void open() } : undefined}
      role={canTry ? 'button' : undefined}
      tabIndex={canTry ? 0 : undefined}
    >
      <div className="flex-shrink-0 w-10 text-center">
        <p className={`font-numbers text-xl leading-none ${past ? 'text-[rgba(26,26,26,0.35)]' : 'text-brand-primary'}`}>
          <LocalGameDay iso={game.scheduled_at} />
        </p>
        <p className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.4)]">
          <LocalGameMonth iso={game.scheduled_at} />
        </p>
      </div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <p className="text-sm font-medium text-[#1a1a1a]">{formatPlayFormat(game.format)}</p>
          {past ? (
            <span className="text-[8px] tracking-[0.15em] uppercase font-medium text-[rgba(26,26,26,0.45)] border border-[#1a1a1a]/20 px-1.5 py-0.5">
              Past
            </span>
          ) : game.is_open ? (
            <span className="text-[8px] tracking-[0.15em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5">
              Open
            </span>
          ) : null}
        </div>
        <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">
          <LocalGameTime iso={game.scheduled_at} />
          {'–'}
          <LocalGameTime iso={endIso} />
          {game.neighborhood ? ` · ${game.neighborhood}` : ''}
        </p>
      </div>
      {editHref && (
        <Link
          href={editHref}
          onClick={(event) => event.stopPropagation()}
          className="w-8 h-8 flex items-center justify-center text-[rgba(26,26,26,0.3)] hover:text-brand-primary transition-colors flex-shrink-0"
        >
          <Pencil size={14} />
        </Link>
      )}
    </div>
    {detail && (
      <GameDetailSheet game={detail} currentUserId={viewerId} onClose={() => setDetail(null)} />
    )}
    </>
  )
}

export function SchedulePreview({
  items,
  seeAllHref,
  empty,
  editFor,
  viewerId = null,
}: {
  items: SchedulePreviewItem[]
  seeAllHref: string
  empty?: ReactNode
  editFor?: (game: SchedulePreviewItem) => string | null
  viewerId?: string | null
}) {
  if (items.length === 0) {
    return empty ? <>{empty}</> : null
  }

  return (
    <div>
      {items.map((game) => (
        <ScheduleGameCard
          key={game.id}
          game={game}
          past={game.past}
          editHref={editFor?.(game) ?? null}
          viewerId={viewerId}
        />
      ))}
      <Link
        href={seeAllHref}
        className="block text-center text-[10px] tracking-[0.18em] uppercase font-medium text-[rgba(26,26,26,0.55)] underline underline-offset-4"
      >
        See all
      </Link>
    </div>
  )
}

export function ScheduleSections({
  upcoming,
  past,
  editFor,
  viewerId = null,
}: {
  upcoming: ScheduleGame[]
  past: ScheduleGame[]
  editFor?: (game: ScheduleGame, past: boolean) => string | null
  viewerId?: string | null
}) {
  return (
    <div>
      {upcoming.length > 0 && (
        <section className="mb-6">
          <p className="px-4 pb-3 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">Upcoming</p>
          <div className="max-w-2xl mx-auto">
            {upcoming.map((game) => (
              <div key={game.id} className="mx-4">
                <ScheduleGameCard game={game} past={false} editHref={editFor?.(game, false) ?? null} viewerId={viewerId} />
              </div>
            ))}
          </div>
        </section>
      )}
      {past.length > 0 && (
        <section>
          <p className="px-4 pb-3 text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.45)] font-medium">Past</p>
          <div className="max-w-2xl mx-auto">
            {past.map((game) => (
              <div key={game.id} className="mx-4">
                <ScheduleGameCard game={game} past editHref={editFor?.(game, true) ?? null} viewerId={viewerId} />
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  )
}
