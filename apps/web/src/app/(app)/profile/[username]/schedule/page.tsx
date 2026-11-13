import { createClient } from '@/lib/supabase/server'
import { notFound, redirect } from 'next/navigation'
import { ActivityHeatmap } from '@/components/schedule/ActivityHeatmap'
import { ScheduleHeader } from '@/components/schedule/ScheduleHeader'
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

  const games = await loadPlayerGames(supabase, profile.id)
  const { upcoming, past } = summarizeSchedule(games)
  const hasGames = upcoming.length > 0 || past.length > 0
  const activityDates = [...upcoming, ...past].map((game) => game.scheduled_at)

  return (
    <div className="min-h-screen">
      <ScheduleHeader backHref={`/profile/${profile.username}`} />

      <div className="max-w-2xl mx-auto pt-2">
        <ActivityHeatmap scheduledAts={activityDates} />

        {!hasGames ? (
          <div className="flex flex-col items-center justify-center px-6 py-16 text-center">
            <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)]">No games yet</p>
          </div>
        ) : (
          <ScheduleSections upcoming={upcoming} past={past} viewerId={viewer?.id ?? null} />
        )}
      </div>
    </div>
  )
}
