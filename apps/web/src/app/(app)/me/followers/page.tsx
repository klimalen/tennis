import { createClient } from '@/lib/supabase/server'
import { AuthGate } from '@/components/auth/AuthGate'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft } from 'lucide-react'
import { FollowersList, type FollowerProfile } from './FollowersList'

async function FollowersContent() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return notFound()

  const { data: rows } = await supabase
    .from('follows')
    .select('follower_id, profiles!follows_follower_id_fkey(id, full_name, username, avatar_url, city_name, skill_level_computed, skill_level_self)')
    .eq('following_id', user.id)
    .order('created_at', { ascending: false })

  const followers = (rows ?? []).map((r) => r.profiles as unknown as FollowerProfile).filter(Boolean)

  return (
    <div className="min-h-screen pb-20 md:pb-0">
      <div className="sticky top-0 bg-brand-bg/95 backdrop-blur-sm z-10 px-4 py-4">
        <div className="max-w-2xl mx-auto flex items-center gap-3">
          <Link href="/me" className="w-9 h-9 rounded-full bg-white border border-[#1a1a1a]/15 flex items-center justify-center hover:bg-brand-field transition-colors">
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
            <p className="text-xs font-fraunces italic text-[#85648F]">When someone follows you, they appear here</p>
          </div>
        ) : (
          <FollowersList followers={followers} />
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
