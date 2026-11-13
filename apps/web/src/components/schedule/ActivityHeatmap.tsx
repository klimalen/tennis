'use client'

import { useMemo, useState } from 'react'
import { buildActivityHeatmap, type HeatLevel } from '@/lib/activity-heatmap'

const LEVEL_CLASS: Record<HeatLevel, string> = {
  0: 'bg-[rgba(26,26,26,0.06)]',
  1: 'bg-[rgba(58,138,122,0.4)]',
  2: 'bg-[rgba(58,138,122,0.72)]',
  3: 'bg-[#E8748A]',
}

const DAY_LABELS = ['', 'Tue', '', 'Thu', '', 'Sat', ''] as const

function formatTip(date: Date, count: number): string {
  const label = date.toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
  if (count <= 0) return `No games on ${label}`
  if (count === 1) return `1 game on ${label}`
  return `${count} games on ${label}`
}

/** GitHub-style play frequency grid for the schedule (and public profile schedule). */
export function ActivityHeatmap({
  scheduledAts,
  weekCount = 26,
  title = 'Activity',
}: {
  scheduledAts: string[]
  weekCount?: number
  title?: string
}) {
  const model = useMemo(
    () => buildActivityHeatmap(scheduledAts, weekCount),
    [scheduledAts, weekCount],
  )
  const [tip, setTip] = useState<string | null>(null)

  return (
    <section className="mb-6 px-4">
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <p className="text-[9px] font-medium uppercase tracking-[0.2em] text-[rgba(26,26,26,0.45)]">{title}</p>
        <p className="text-[11px] text-[rgba(26,26,26,0.4)]">
          {model.totalGames > 0
            ? `${model.totalGames} game${model.totalGames === 1 ? '' : 's'} · ${model.activeDays} day${model.activeDays === 1 ? '' : 's'}`
            : 'Play days show up here'}
        </p>
      </div>

      <div className="overflow-x-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
        <div className="inline-flex min-w-full flex-col gap-1.5">
          <div className="flex gap-[3px] pl-6">
            {model.weeks.map((week, index) => (
              <div
                key={`m-${index}`}
                className="w-[11px] text-center text-[8px] leading-none tracking-[0.04em] text-[rgba(26,26,26,0.35)]"
              >
                {week.monthLabel ?? ''}
              </div>
            ))}
          </div>

          <div className="flex gap-1.5">
            <div className="flex w-5 flex-col justify-between py-px">
              {DAY_LABELS.map((label, index) => (
                <span
                  key={`d-${index}`}
                  className="h-[11px] text-[8px] leading-[11px] text-[rgba(26,26,26,0.35)]"
                >
                  {label}
                </span>
              ))}
            </div>

            <div className="flex gap-[3px]">
              {model.weeks.map((week, weekIndex) => (
                <div key={`w-${weekIndex}`} className="flex flex-col gap-[3px]">
                  {week.cells.map((cell) => (
                    <button
                      key={cell.key}
                      type="button"
                      disabled={!cell.inRange}
                      title={cell.inRange ? formatTip(cell.date, cell.count) : undefined}
                      aria-label={cell.inRange ? formatTip(cell.date, cell.count) : undefined}
                      onFocus={() => cell.inRange && setTip(formatTip(cell.date, cell.count))}
                      onBlur={() => setTip(null)}
                      onMouseEnter={() => cell.inRange && setTip(formatTip(cell.date, cell.count))}
                      onMouseLeave={() => setTip(null)}
                      className={`h-[11px] w-[11px] rounded-[2px] transition-opacity ${
                        cell.inRange ? LEVEL_CLASS[cell.level] : 'bg-transparent'
                      } ${cell.inRange ? 'hover:opacity-80 focus:outline-none focus:ring-1 focus:ring-brand-primary/40' : ''}`}
                    />
                  ))}
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-2 flex items-center justify-between gap-3">
        <p className="min-h-[1rem] text-[11px] text-[rgba(26,26,26,0.4)]">{tip ?? '\u00a0'}</p>
        <div className="flex items-center gap-1.5 text-[9px] uppercase tracking-[0.12em] text-[rgba(26,26,26,0.35)]">
          <span>Less</span>
          {([0, 1, 2, 3] as HeatLevel[]).map((level) => (
            <span key={level} className={`h-[11px] w-[11px] rounded-[2px] ${LEVEL_CLASS[level]}`} aria-hidden />
          ))}
          <span>More</span>
        </div>
      </div>
    </section>
  )
}
