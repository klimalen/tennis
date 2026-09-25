import { gameEndMs } from '@/lib/game-time'

export interface ScheduleGame {
  id: string
  scheduled_at: string
  duration_minutes: number | null
  format: string
  neighborhood: string | null
  is_open: boolean
  status: string
  creator_id: string
}

export interface SchedulePreviewItem extends ScheduleGame {
  past: boolean
}

export function summarizeSchedule(games: ScheduleGame[], now = Date.now()) {
  const active = games.filter((game) => game.status !== 'cancelled' && game.status !== 'draft')
  const upcoming = active
    .filter((game) => gameEndMs(game.scheduled_at, game.duration_minutes) > now)
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))
  const past = active
    .filter((game) => gameEndMs(game.scheduled_at, game.duration_minutes) <= now)
    .sort((a, b) => gameEndMs(b.scheduled_at, b.duration_minutes) - gameEndMs(a.scheduled_at, a.duration_minutes))

  let preview: SchedulePreviewItem[]
  if (upcoming.length >= 2) {
    preview = upcoming.slice(0, 2).map((game) => ({ ...game, past: false }))
  } else if (upcoming.length === 1) {
    preview = [
      { ...upcoming[0]!, past: false },
      ...past.slice(0, 1).map((game) => ({ ...game, past: true })),
    ]
  } else {
    preview = past.slice(0, 2).map((game) => ({ ...game, past: true }))
  }

  return { upcoming, past, preview, playedCount: past.length }
}
