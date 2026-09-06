import { AuthGate } from '@/components/auth/AuthGate'
import { createClient } from '@/lib/supabase/server'
import { Grid3X3, Trophy, BarChart3, Settings } from 'lucide-react'
import Link from 'next/link'
import Image from 'next/image'

const SKILL_LABELS: Record<number, string> = {
  1: '1.0 — Beginner',
  1.5: '1.5 — Beginner+',
  2: '2.0 — Novice',
  2.5: '2.5 — Novice+',
  3: '3.0 — Intermediate',
  3.5: '3.5 — Intermediate+',
  4: '4.0 — Advanced',
  4.5: '4.5 — Advanced+',
  5: '5.0 — Expert',
  5.5: '5.5 — Expert+',
  6: '6.0 — Pro',
  6.5: '6.5 — Pro+',
  7: '7.0 — Elite',
}

function skillLabel(level: number | null): string {
  if (!level) return '—'
  return SKILL_LABELS[level] ?? `${level}`
}

async function ProfileContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return null

  const { data: profile } = await supabase
    .from('profiles')
    .select('full_name, username, avatar_url, skill_level_self, skill_level_computed, total_matches, bio, city_id')
    .eq('id', user.id)
    .single()

  // Count wins from match_results where winner_id = user.id
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
      <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-gray-100 z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <h1 className="text-xl font-bold text-gray-900">Me</h1>
          <Link href="/settings" className="w-9 h-9 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors">
            <Settings size={16} className="text-gray-600" />
          </Link>
        </div>
      </div>
      <div className="max-w-2xl mx-auto">
        <div className="px-4 pt-6 pb-4">
          <div className="flex items-start gap-4">
            <div className="w-20 h-20 rounded-full bg-gray-100 flex items-center justify-center flex-shrink-0 border-2 border-gray-200 overflow-hidden">
              {avatarUrl ? (
                <Image src={avatarUrl} alt={fullName} width={80} height={80} className="w-full h-full object-cover" />
              ) : (
                <span className="text-3xl">👤</span>
              )}
            </div>
            <div className="flex-1 flex items-center justify-around pt-2">
              {[
                { value: String(totalMatches), label: 'Matches' },
                { value: String(totalWins), label: 'Wins' },
                { value: rating ? String(rating) : '—', label: 'Rating' },
              ].map((stat) => (
                <div key={stat.label} className="flex flex-col items-center">
                  <span className="text-lg font-bold text-gray-900">{stat.value}</span>
                  <span className="text-xs text-gray-500">{stat.label}</span>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-3">
            <p className="font-semibold text-gray-900">{fullName}</p>
            {username && <p className="text-sm text-gray-500">@{username}</p>}
            {rating && (
              <p className="text-xs text-green-700 font-medium mt-0.5">{skillLabel(rating)}</p>
            )}
            {profile?.bio && (
              <p className="text-sm text-gray-600 mt-1">{profile.bio}</p>
            )}
            <Link
              href="/me/edit"
              className="block w-full mt-2 py-1.5 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors text-center"
            >
              Edit profile
            </Link>
          </div>
        </div>
        <div className="border-t border-gray-100">
          <div className="flex">
            {[{ icon: Grid3X3 }, { icon: Trophy }, { icon: BarChart3 }].map((tab, i) => {
              const Icon = tab.icon
              return (
                <button key={i} className={`flex-1 flex flex-col items-center py-3 border-b-2 transition-colors ${i === 0 ? 'border-gray-900' : 'border-transparent text-gray-400'}`}>
                  <Icon size={20} />
                </button>
              )
            })}
          </div>
          <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
            <div className="w-14 h-14 rounded-full bg-gray-100 flex items-center justify-center mb-3">
              <Grid3X3 size={24} className="text-gray-400" />
            </div>
            <p className="text-sm font-semibold text-gray-900 mb-1">No posts yet</p>
            <p className="text-xs text-gray-500">Share your first match or photo</p>
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
