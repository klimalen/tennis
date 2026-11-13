'use client'

import type { ReactNode } from 'react'
import Link from 'next/link'
import { ChevronLeft } from 'lucide-react'
import { useHideTabBar } from '@/components/navigation/TabBarVisibility'

/**
 * Same compact chrome as PLAYERS / COURTS / GAMES section toolbars:
 * back · title · optional action, with the bottom tab bar hidden.
 */
export function ScheduleHeader({
  backHref,
  action,
}: {
  backHref: string
  action?: ReactNode
}) {
  useHideTabBar(true)

  return (
    <div className="page-header max-w-full !py-3">
      <div className="mx-auto flex min-w-0 max-w-2xl items-center gap-1.5">
        <Link
          href={backHref}
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-[#1a1a1a]/15 bg-white text-[rgba(26,26,26,0.6)] transition-colors hover:bg-brand-field"
          aria-label="Back"
        >
          <ChevronLeft size={16} />
        </Link>
        <span className="shrink-0 font-display text-2xl tracking-wide text-[#1a1a1a]">SCHEDULE</span>
        {action ? <div className="ml-auto flex shrink-0 items-center">{action}</div> : null}
      </div>
    </div>
  )
}
