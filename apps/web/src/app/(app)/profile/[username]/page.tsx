import { createClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft, MapPin } from 'lucide-react'
import { PlayTogetherButton } from './PlayTogetherButton'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}
const SKILL_NAMES: Record<number, string> = {
  1: 'Beginner', 1.5: 'Beginner', 2: 'Novice', 2.5: 'Novice',
  3: 'Intermediate', 3.5: 'Intermediate', 4: 'Advanced', 4.5: 'Advanced',
  5: 'Expert', 5.5: 'Expert', 6: 'Pro', 6.5: 'Pro', 7: 'Elite',
}

const FORMAT_LABELS: Record<string, string> = {
  singles: 'Singles', doubles: 'Doubles', mixed_doubles: 'Mixed doubles',
}

const DAY_LABELS: Record<number, string> = {
  1: 'Mon', 2: 'Tue', 3: 'Wed', 4: 'Thu', 5: 'Fri', 6: 'Sat', 0: 'Sun',
}

function skillLevel(v: number | null) {
  if (!v) return null
  const rounded = Math.round(v * 2) / 2
  return { label: SKILL_LABELS[rounded] ?? v.toFixed(1), name: SKILL_NAMES[rounded] ?? '' }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PlayerProfilePage({
  params,
}: {
  params: Promise<{ username: string }>
}) {
  const { username } = await params
  const supabase = await createClient()

  const { data: { user: viewer } } = await supabase.auth.getUser()

  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'id, full_name, username, avatar_url, bio, city_name, skill_level_self, skill_level_computed, total_matches, preferred_formats, play_style, years_playing, preferred_days, preferred_time_start, preferred_time_end',
    )
    .eq('username', username)
    .is('deleted_at', null)
    .single()

  if (!profile) notFound()

  const { count: wins } = await supabase
    .from('match_results')
    .select('*', { count: 'exact', head: true })
    .eq('winner_id', profile.id)
    .eq('status', 'confirmed')

  // Check if viewer already sent a request
  let existingRequestStatus: string | null = null
  if (viewer && viewer.id !== profile.id) {
    const { data: existingReq } = await supabase
      .from('game_requests')
      .select('status')
      .eq('sender_id', viewer.id)
      .eq('receiver_id', profile.id)
      .maybeSingle()
    existingRequestStatus = existingReq?.status ?? null
  }

  const rating = profile.skill_level_computed ?? profile.skill_level_self
  const skill = skillLevel(rating)
  const totalWins = wins ?? 0
  const initials = profile.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

  const timeLabel = profile.preferred_time_start && profile.preferred_time_end
    ? `${profile.preferred_time_start.slice(0, 5)} – ${profile.preferred_time_end.slice(0, 5)}`
    : null

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      {/* Header */}
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/search" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-2xl tracking-wide text-[#1a1a1a]">
            {profile.full_name.toUpperCase()}
          </span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {/* Profile header */}
        <div className="px-4 pt-6 pb-5">
          <div className="flex items-start gap-5">
            {/* Avatar */}
            <div className="w-20 h-20 bg-brand-surface flex items-center justify-center flex-shrink-0 border border-brand-divider overflow-hidden">
              {profile.avatar_url ? (
                <Image src={profile.avatar_url} alt={profile.full_name} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <span className="font-display text-3xl text-[rgba(26,26,26,0.3)]">{initials}</span>
              )}
            </div>

            {/* Stats */}
            <div className="flex-1 flex items-center justify-around pt-1">
              {[
                { value: String(profile.total_matches), label: 'Matches' },
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
          <div className="mt-4 space-y-1.5">
            <p className="font-display text-2xl tracking-wide leading-none">{profile.full_name.toUpperCase()}</p>
            <p className="text-[11px] tracking-[0.15em] text-[rgba(26,26,26,0.4)]">@{profile.username}</p>

            {profile.city_name && (
              <p className="flex items-center gap-1 text-[11px] text-[rgba(26,26,26,0.45)]">
                <MapPin size={11} />
                {profile.city_name}
              </p>
            )}

            {skill && (
              <div className="pt-0.5">
                <span className="text-[9px] tracking-[0.15em] uppercase text-brand-primary font-medium border border-brand-primary px-2 py-0.5">
                  {skill.label} — {skill.name}
                </span>
              </div>
            )}

            {profile.bio && (
              <p className="text-sm text-[rgba(26,26,26,0.6)] font-script italic pt-1">{profile.bio}</p>
            )}
          </div>

          {/* Play together button — only shown to other logged-in users */}
          {viewer && viewer.id !== profile.id && (
            <PlayTogetherButton receiverId={profile.id} existingStatus={existingRequestStatus} />
          )}
        </div>

        {/* Divider */}
        <div className="border-t border-brand-divider" />

        {/* Game preferences */}
        <div className="px-4 py-5 space-y-4">
          <p className="text-[9px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)] font-medium">Game preferences</p>

          <div className="grid grid-cols-2 gap-x-6 gap-y-3">
            {profile.preferred_formats?.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1">Format</p>
                <div className="flex flex-wrap gap-1">
                  {profile.preferred_formats.map((f: string) => (
                    <span key={f} className="px-2 py-0.5 border border-brand-divider text-[10px] text-[rgba(26,26,26,0.6)]">
                      {FORMAT_LABELS[f] ?? f}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {profile.play_style && (
              <div>
                <p className="text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1">Style</p>
                <p className="text-sm text-[rgba(26,26,26,0.7)] capitalize">{profile.play_style.replace('_', ' ')}</p>
              </div>
            )}

            {profile.years_playing != null && (
              <div>
                <p className="text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1">Experience</p>
                <p className="text-sm text-[rgba(26,26,26,0.7)]">{profile.years_playing} {profile.years_playing === 1 ? 'year' : 'years'}</p>
              </div>
            )}

            {profile.preferred_days?.length > 0 && (
              <div>
                <p className="text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1">Available</p>
                <p className="text-sm text-[rgba(26,26,26,0.7)]">
                  {profile.preferred_days.map((d: number) => DAY_LABELS[d]).join(', ')}
                </p>
              </div>
            )}

            {timeLabel && (
              <div>
                <p className="text-[9px] tracking-[0.15em] uppercase text-[rgba(26,26,26,0.35)] mb-1">Time</p>
                <p className="text-sm text-[rgba(26,26,26,0.7)]">{timeLabel}</p>
              </div>
            )}
          </div>
        </div>

        {/* Match history placeholder */}
        <div className="border-t border-brand-divider">
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.35)]">No matches yet</p>
          </div>
        </div>
      </div>
    </div>
  )
}
