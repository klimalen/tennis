import { createClient } from '@/lib/supabase/server'
import { Settings } from 'lucide-react'
import Link from 'next/link'
import { LocalGameDay, LocalGameMonth, LocalGameTime } from '@/components/ui/LocalGameTime'
import { holdsGameSeat } from '@/lib/schedule'

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles',
  doubles: 'Doubles',
  mixed_doubles: 'Mixed',
}

interface Seat {
  status: string
  profiles: { full_name: string; username: string } | null
}

interface CourtGame {
  id: string
  scheduled_at: string
  format: string
  neighborhood: string | null
  max_players: number
  game_participants: Seat[] | null
}

export async function CourtHome() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, city_name, phone, website, bio')
    .eq('id', user.id)
    .single()

  const { data: games } = await supabase
    .from('games')
    .select('id, scheduled_at, format, neighborhood, max_players, game_participants ( status, profiles ( full_name, username ) )')
    .eq('creator_id', user.id)
    .eq('status', 'confirmed')
    .gte('scheduled_at', new Date().toISOString())
    .order('scheduled_at', { ascending: true })

  const upcoming = (games ?? []) as unknown as CourtGame[]
  const name = profile?.full_name || 'Court'
  const website = profile?.website
    ? (profile.website.startsWith('http') ? profile.website : `https://${profile.website}`)
    : null

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-3xl tracking-wide text-[#1a1a1a]">COURT</span>
          <Link href="/settings" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <Settings size={16} className="text-[rgba(26,26,26,0.5)]" />
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto px-4 pt-6 pb-8 space-y-6">
        <div>
          <p className="font-display text-3xl tracking-wide leading-none">{name.toUpperCase()}</p>
          {profile?.username && (
            <p className="font-fraunces italic text-sm text-[rgba(26,26,26,0.55)] mt-1">@{profile.username}</p>
          )}
          {profile?.city_name && (
            <p className="text-[11px] text-[rgba(26,26,26,0.45)] mt-1">{profile.city_name}</p>
          )}
          {profile?.bio && (
            <p className="font-copy text-sm text-[#497250] leading-snug mt-3">{profile.bio}</p>
          )}
          <div className="mt-3 space-y-1 text-sm text-[rgba(26,26,26,0.65)]">
            {profile?.phone && <p>{profile.phone}</p>}
            {website && (
              <a href={website} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2">
                {profile?.website}
              </a>
            )}
          </div>
        </div>

        <div className="flex gap-2">
          <Link href="/games/new" className="flex-1 py-3 rounded-full bg-[#E8748A] text-[#1a1a1a] text-center text-[10px] tracking-[0.16em] uppercase font-medium hover:bg-[#E8406A]">
            New game
          </Link>
          <Link href="/feed/new" className="flex-1 py-3 rounded-full bg-brand-field border border-[#1a1a1a]/15 text-[#1a1a1a] text-center text-[10px] tracking-[0.16em] uppercase font-medium hover:bg-white">
            New post
          </Link>
        </div>

        <div>
          <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] font-medium mb-3">Upcoming games</p>
          {upcoming.length === 0 ? (
            <p className="text-sm text-[rgba(26,26,26,0.5)]">
              No upcoming games. Create one and players in your city can join. This court does not take a spot.
            </p>
          ) : (
            <div className="space-y-3">
              {upcoming.map((game) => {
                const seats = (game.game_participants ?? []).filter((seat) => holdsGameSeat(seat.status) && seat.profiles)
                return (
                  <div key={game.id} className="rounded-[28px] bg-white px-4 py-4">
                    <p className="font-display text-2xl tracking-wide leading-none">
                      <LocalGameDay iso={game.scheduled_at} /> <LocalGameMonth iso={game.scheduled_at} />
                    </p>
                    <p className="text-[12px] text-[rgba(26,26,26,0.55)] mt-1">
                      <LocalGameTime iso={game.scheduled_at} />
                      {' · '}
                      {FORMAT_LABELS[game.format] ?? game.format}
                      {game.neighborhood ? ` · ${game.neighborhood}` : ''}
                      {' · '}
                      {seats.length}/{game.max_players}
                    </p>
                    {seats.length > 0 && (
                      <ul className="mt-2 space-y-1">
                        {seats.map((seat) => (
                          <li key={seat.profiles!.username} className="text-sm text-[#1a1a1a]">
                            {seat.profiles!.full_name}
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
