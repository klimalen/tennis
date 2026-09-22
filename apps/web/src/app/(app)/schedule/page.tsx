import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import Link from 'next/link'
import { formatPlayFormat } from '@/lib/skill'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'

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

  const now = new Date().toISOString()

  const { data: createdGames } = await supabase
    .from('games')
    .select('id, scheduled_at, format, neighborhood, is_open, creator_id')
    .eq('creator_id', user.id)
    .eq('status', 'confirmed')
    .gte('scheduled_at', now)
    .order('scheduled_at', { ascending: true })

  const { data: acceptedParticipations } = await supabase
    .from('game_participants')
    .select('game_id')
    .eq('player_id', user.id)
    .eq('status', 'accepted')

  const acceptedGameIds = (acceptedParticipations ?? []).map((r) => r.game_id as string)

  const { data: invitedGames } = acceptedGameIds.length > 0
    ? await supabase
        .from('games')
        .select('id, scheduled_at, format, neighborhood, is_open, creator_id')
        .in('id', acceptedGameIds)
        .neq('creator_id', user.id)
        .eq('status', 'confirmed')
        .gte('scheduled_at', now)
    : { data: [] }

  const upcomingGames = [...(createdGames ?? []), ...(invitedGames ?? [])]
    .sort((a, b) => a.scheduled_at.localeCompare(b.scheduled_at))

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto">
          <span className="font-display text-3xl tracking-wide">UPCOMING</span>
        </div>
      </div>

      {upcomingGames.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-24 px-6 text-center">
          <p className="font-display text-7xl text-brand-surface-lg leading-none mb-6">✦</p>
          <p className="text-[10px] tracking-[0.25em] uppercase font-medium text-[rgba(26,26,26,0.35)] mb-2">No games yet</p>
          <p className="text-sm text-[rgba(26,26,26,0.45)] max-w-xs">
            Games you create or join show up here.
          </p>
          <div className="mt-6 flex flex-col items-center gap-2">
            <Link
              href="/games/new"
              className="px-6 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
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
        <div className="max-w-2xl mx-auto">
          {upcomingGames.map((game) => (
            <div key={game.id} className="px-4 py-3 border-b border-brand-divider flex items-center gap-4">
              <div className="flex-shrink-0 w-10 text-center">
                <p className="font-numbers text-xl leading-none text-brand-primary"><LocalGameDay iso={game.scheduled_at} /></p>
                <p className="text-[9px] tracking-[0.1em] uppercase text-[rgba(26,26,26,0.4)]">
                  <LocalGameMonth iso={game.scheduled_at} />
                </p>
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-sm font-medium text-[#1a1a1a]">{formatPlayFormat(game.format)}</p>
                  {game.is_open && (
                    <span className="text-[8px] tracking-[0.15em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5">Open</span>
                  )}
                </div>
                <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-0.5">
                  <LocalGameTime iso={game.scheduled_at} />{game.neighborhood ? ` · ${game.neighborhood}` : ''}
                </p>
              </div>
              {game.creator_id === user.id && (
                <Link
                  href={`/games/${game.id}/edit`}
                  className="text-[10px] tracking-[0.12em] uppercase text-[rgba(26,26,26,0.4)] hover:text-brand-primary"
                >
                  Edit
                </Link>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
