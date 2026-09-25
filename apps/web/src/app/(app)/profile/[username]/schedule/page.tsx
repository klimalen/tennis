import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { ScheduleSections } from '@/components/schedule/ScheduleBlocks'
import { loadPlayerGames } from '@/lib/player-games'
import { summarizeSchedule } from '@/lib/schedule'

export default async function ProfileSchedulePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()
  const { data: { user: viewer } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, full_name, username')
    .eq('username', username)
    .is('deleted_at', null)
    .single()

  if (!profile) notFound()
  if (viewer && viewer.id === profile.id) redirect('/schedule')

  const { upcoming, past } = summarizeSchedule(await loadPlayerGames(supabase, profile.id))
  const hasGames = upcoming.length > 0 || past.length > 0

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href={`/profile/${profile.username}`} className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-3xl tracking-wide">SCHEDULE</span>
        </div>
      </div>

      {!hasGames ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)]">No games yet</p>
        </div>
      ) : (
        <div className="max-w-2xl mx-auto pt-2">
          <ScheduleSections upcoming={upcoming} past={past} />
        </div>
      )}
    </div>
  )
}
