import { createClient } from '@/lib/supabase/server'
import { AuthGate } from '@/components/auth/AuthGate'
import { notFound } from 'next/navigation'
import Image from 'next/image'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'

const SKILL_LABELS: Record<number, string> = {
  1: '1.0', 1.5: '1.5', 2: '2.0', 2.5: '2.5', 3: '3.0', 3.5: '3.5',
  4: '4.0', 4.5: '4.5', 5: '5.0', 5.5: '5.5', 6: '6.0', 6.5: '6.5', 7: '7.0',
}
const SKILL_NAMES: Record<number, string> = {
  1: 'Beginner', 1.5: 'Beginner', 2: 'Novice', 2.5: 'Novice',
  3: 'Intermediate', 3.5: 'Intermediate', 4: 'Advanced', 4.5: 'Advanced',
  5: 'Expert', 5.5: 'Expert', 6: 'Pro', 6.5: 'Pro', 7: 'Elite',
}

async function FollowersContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: rows } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self)')
    .eq('following_id', user.id)
    .order('created_at', { ascending: false })

  type FollowerProfile = {
    id: string
    full_name: string
    username: string | null
    avatar_url: string | null
    city_name: string | null
    skill_level_computed: number | null
    skill_level_self: number | null
  }

  const followers = (rows ?? []).map((r) => r.profiles as unknown as FollowerProfile).filter(Boolean)

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/90 backdrop-blur-sm border-b border-brand-divider z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/me" className="w-9 h-9 bg-brand-surface flex items-center justify-center hover:bg-brand-surface-md transition-colors">
            <ArrowLeft size={16} className="text-[rgba(26,26,26,0.6)]" />
          </Link>
          <span className="font-display text-3xl tracking-wide">FOLLOWERS</span>
          <span className="text-[rgba(26,26,26,0.35)] text-sm font-numbers">{followers.length}</span>
        </div>
      </div>

      <div className="max-w-2xl mx-auto">
        {followers.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 px-4 text-center">
            <p className="font-display text-5xl text-brand-surface-lg mb-2">✦</p>
            <p className="text-[10px] tracking-[0.2em] uppercase text-[rgba(26,26,26,0.4)] mb-1">No followers yet</p>
            <p className="text-xs text-[rgba(26,26,26,0.3)]">Play with others to grow your network</p>
          </div>
        ) : (
          <div>
            {followers.map((f) => {
              const rating = f.skill_level_computed ?? f.skill_level_self
              const rounded = rating ? Math.round(rating * 2) / 2 : null
              const skillLabel = rounded ? `${SKILL_LABELS[rounded] ?? rounded} — ${SKILL_NAMES[rounded] ?? ''}` : null
              const initials = f.full_name.split(' ').map((w: string) => w[0] ?? '').join('').slice(0, 2).toUpperCase()

              return (
                <Link
                  key={f.id}
                  href={f.username ? `/profile/${f.username}` : '#'}
                  className="flex items-center gap-4 px-4 py-3 border-b border-brand-divider hover:bg-brand-surface transition-colors"
                >
                  <div className="w-12 h-12 bg-brand-surface border border-brand-divider overflow-hidden flex items-center justify-center flex-shrink-0">
                    {f.avatar_url ? (
                      <Image src={f.avatar_url} alt={f.full_name} width={48} height={48} className="w-full h-full object-cover" />
                    ) : (
                      <span className="font-display text-lg text-[rgba(26,26,26,0.3)]">{initials}</span>
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-display text-base tracking-wide leading-none text-[#1a1a1a]">{f.full_name.toUpperCase()}</p>
                    {f.username && (
                      <p className="text-[10px] tracking-[0.12em] text-[rgba(26,26,26,0.4)] mt-0.5">@{f.username}</p>
                    )}
                    {f.city_name && (
                      <p className="text-[10px] text-[rgba(26,26,26,0.35)] mt-0.5">{f.city_name}</p>
                    )}
                  </div>
                  {skillLabel && (
                    <span className="text-[8px] tracking-[0.12em] uppercase font-medium text-brand-primary border border-brand-primary px-1.5 py-0.5 flex-shrink-0">
                      {skillLabel}
                    </span>
                  )}
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}

export default function FollowersPage() {
  return (
    <AuthGate section="me">
      <FollowersContent />
    </AuthGate>
  )
}
