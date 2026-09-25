import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { ScheduleSections } from '@/components/schedule/ScheduleBlocks'
import { loadPlayerGames } from '@/lib/player-games'
import { summarizeSchedule } from '@/lib/schedule'

export default function SchedulePage() {
  return (
    <AuthGate section="schedule">
      <ScheduleContent />
    </AuthGate>
  )
}

async function ScheduleContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { upcoming, past } = summarizeSchedule(await loadPlayerGames(supabase, user.id))
  const hasGames = upcoming.length > 0 || past.length > 0

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-5xl tracking-wide">SCHEDULE</span>
          <Link
            href="/games/new"
            className="text-[10px] tracking-[0.16em] uppercase font-medium text-brand-primary hover:underline"
          >
            New game
          </Link>
        </div>
      </div>

      {!hasGames ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">No games yet</p>
          <p className="text-sm text-[rgba(26,26,26,0.45)] max-w-xs">
            Games you create or join show up here
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link
              href="/games/new"
              className="px-6 py-2.5 rounded-full bg-[#E8748A] text-[#1a1a1a] text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-[#E8406A] transition-colors"
            >
              Create a game
            </Link>
            <Link
              href="/search"
              className="text-[11px] text-brand-primary tracking-[0.1em] uppercase font-medium hover:underline"
            >
              Find a game
            </Link>
          </div>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto pt-2">
          <ScheduleSections
            upcoming={upcoming}
            past={past}
            viewerId={user.id}
            allowEdit
          />
        </div>
      )}
    </div>
  )
}
