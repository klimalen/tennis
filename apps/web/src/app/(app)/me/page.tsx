import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { Settings, CalendarDays } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}
const SKILL_NAMES: Record<number, string> = {
  1: 'Beginner', 1.5: 'Beginner', 2: 'Novice', 2.5: 'Novice',
  3: 'Intermediate', 3.5: 'Intermediate', 4: 'Advanced', 4.5: 'Advanced',
  5: 'Expert', 5.5: 'Expert', 6: 'Pro', 6.5: 'Pro', 7: 'Elite',
}

async function ProfileContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, avatar_url, skill_level_self, skill_level_computed, total_matches, bio')
    .eq('id', user.id)
    .single()

  const { count: wins } = await supabase
    .from('match_results')
    .select('*', { count: 'exact', head: true })
    .eq('winner_id', user.id)
    .eq('status', 'confirmed')

  const fullName = profile?.full_name || 'Tennis Player'
  const username = profile?.username || ''
  const avatarUrl = profile?.avatar_url || null
  const totalMatches = profile?.total_matches ?? 0
  const totalWins = wins ?? 0
  const rating = profile?.skill_level_computed ?? profile?.skill_level_self ?? null

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <span className="font-display text-3xl tracking-wide text-[#1a1a1a]">PROFILE</span>
          <Link href="/settings" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <Settings size={16} className="text-[rgba(26,26,26,0.5)]" />
          </Link>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="px-4 pt-6 pb-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 bg-brand-surface flex items-center justify-center flex-shrink-0 border border-brand-divider overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={fullName} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">👤</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around pt-1">
              {[
                { value: String(totalMatches), label: 'Matches' },
                { value: String(totalWins), label: 'Wins' },
                { value: rating ? String(rating) : '—', label: 'Rating' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center gap-0.5">
                  <span className="font-numbers text-3xl leading-none text-brand-primary">{stat.value}</span>
                  <span className="text-[9px] tracking-[0.18em] uppercase text-[rgba(26,26,26,0.4)]">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Name + meta */}
          <div className="mt-4">
            <p className="font-display text-2xl tracking-wide leading-none">{fullName.toUpperCase()}</p>
            {username && (
              <p className="text-[11px] tracking-[0.15em] text-[rgba(26,26,26,0.4)] mt-1">@{username}</p>
            )}
            {rating && (
              <div className="inline-flex items-center gap-1.5 mt-2">
                <span className="text-[9px] tracking-[0.15em] uppercase text-brand-primary font-medium border border-brand-primary px-2 py-0.5">
                  {SKILL_LABELS[rating]} — {SKILL_NAMES[rating]}
                </span>
              </div>
            )}
            {profile?.bio && (
              <p className="text-sm text-[rgba(26,26,26,0.6)] mt-2 font-script italic">{profile.bio}</p>
            )}
            <Link
              href="/me/edit"
              className="block w-full mt-3 py-2 border border-brand-divider text-[10px] tracking-[0.2em] uppercase font-medium text-[rgba(26,26,26,0.5)] hover:border-brand-primary hover:text-brand-primary transition-colors text-center"
            >
              Edit profile
            </Link>
          </div>
        </div>

        {/* Tab bar */}
        <div className="border-t border-brand-divider">
          <div className="flex">
            {['Matches', 'Trophies', 'Stats'].map((label, i) => (
              <button
                key={label}
                className={`flex-1 py-3 text-[9px] tracking-[0.2em] uppercase font-medium border-b-2 transition-colors ${
                  i === 0
                    ? 'border-brand-primary text-brand-primary'
                    : 'border-transparent text-[rgba(26,26,26,0.3)]'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {/* Empty state */}
          <div className="flex flex-col items-center justify-center py-20 px-4 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">No matches yet</p>
            <p className="text-xs text-[rgba(26,26,26,0.3)]">Find a game and start building your history</p>
            <Link
              href="/search"
              className="mt-5 px-6 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
            >
              Find players
            </Link>
          </div>
        </div>

        {/* Schedule section */}
        <div className="border-t border-brand-divider">
          <div className="px-4 py-4 flex items-center gap-2">
            <CalendarDays size={14} className="text-[rgba(26,26,26,0.4)]" />
            <span className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">Schedule</span>
          </div>
          <div className="flex flex-col items-center justify-center py-10 px-4 text-center">
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] mb-1">No upcoming games</p>
            <p className="text-xs text-[rgba(26,26,26,0.3)] font-script italic">
              Your upcoming games and court bookings will appear here.
            </p>
            <Link
              href="/search"
              className="mt-4 px-6 py-2.5 bg-brand-primary text-white text-[10px] tracking-[0.2em] uppercase font-medium hover:bg-brand-primary-dark transition-colors"
            >
              Find a game
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default async function MePage() {
  return (
    <AuthGate section="me">
      <ProfileContent />
    </AuthGate>
  )
}
